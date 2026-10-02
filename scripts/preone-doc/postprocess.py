#!/usr/bin/env python3
# postprocess.py — WPS-compat footer format switches + empty pgNumType removal
# Per docx skill toc.md: Roman section footer instrText must be "PAGE \* ROMAN \* MERGEFORMAT",
# Arabic section "PAGE \* arabic \* MERGEFORMAT"; remove empty <w:pgNumType/> from cover section.
import re, sys, zipfile, shutil, os

DOCX = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/PreOne_Canonical_Product_Flow_Audit_v1.0.docx"
TMP = DOCX + ".tmp"

with zipfile.ZipFile(DOCX, "r") as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

doc = data["word/document.xml"].decode("utf-8")
rels = data["word/_rels/document.xml.rels"].decode("utf-8")

# Map rId -> footer file
rel_map = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="(footer\d+\.xml)"', rels))
rel_map.update({m[0]: m[1] for m in re.findall(r'<Relationship[^>]*Target="(?:.*?)(footer\d+\.xml)"[^>]*Id="([^"]+)"', rels) and []})

# sectPr blocks in document order; last sectPr is the final section's
sect_blocks = re.findall(r"<w:sectPr[^>]*>.*?</w:sectPr>", doc, flags=re.S)
print(f"sections found: {len(sect_blocks)}")

def footer_ids(block):
    return re.findall(r'<w:footerReference[^>]*r:id="([^"]+)"', block)

# Section order: 0=cover(no footer), 1=front matter(ROMAN), 2=body(arabic)
fmt_for_section = {1: "ROMAN", 2: "arabic"}
for idx, block in enumerate(sect_blocks):
    fmt = fmt_for_section.get(idx)
    if not fmt:
        continue
    for rid in footer_ids(block):
        fname = "word/" + rel_map.get(rid, "")
        if fname not in data:
            continue
        fx = data[fname].decode("utf-8")
        fx2, n = re.subn(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            r"\g<1> PAGE \\* " + fmt + r" \\* MERGEFORMAT \g<2>",
            fx,
        )
        if n:
            data[fname] = fx2.encode("utf-8")
            print(f"patched {fname} -> {fmt} ({n} field(s))")

# Remove empty pgNumType (cover section emits it, confuses WPS)
doc2, n = re.subn(r"<w:pgNumType/>", "", doc)
if n:
    print(f"removed {n} empty <w:pgNumType/>")
data["word/document.xml"] = doc2.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n2 in names:
        zout.writestr(n2, data[n2])
shutil.move(TMP, DOCX)
print("OK", DOCX)
