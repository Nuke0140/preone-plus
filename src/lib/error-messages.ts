/**
 * PreOne Enterprise Error Messages Registry
 * Single authoritative source for user-facing error text and actionable guidance.
 */

import { ErrorCodes } from './error-codes'

export const ErrorMessages: Record<string, string> = {
  // Authentication & Authorization
  [ErrorCodes.AUTH_REQUIRED]: 'Please sign in to continue.',
  [ErrorCodes.AUTH_INVALID_SESSION]: 'Your session has expired or is invalid. Please sign in again.',
  [ErrorCodes.AUTH_EXPIRED_SESSION]: 'Your session has expired. Please sign in again.',
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials provided. Please verify your details.',
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 'Account temporarily locked. Please contact your school administrator.',

  [ErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action. Please contact your school administrator.',
  [ErrorCodes.PERMISSION_OWNER_ESCALATION]: 'Only school owners or platform administrators can modify owner accounts.',
  [ErrorCodes.PERMISSION_BRANCH_RESTRICTED]: 'Access restricted. You cannot manage resources outside your assigned campus branch.',
  [ErrorCodes.PERMISSION_ROLE_ESCALATION]: 'You cannot assign a role with higher privileges than your own.',
  [ErrorCodes.PERMISSION_CROSS_TENANT]: 'Resource not found.',

  // Not Found
  [ErrorCodes.NOT_FOUND_RESOURCE]: 'The requested resource could not be found.',
  [ErrorCodes.NOT_FOUND_USER]: 'User account not found.',
  [ErrorCodes.NOT_FOUND_STAFF]: 'Staff member profile not found.',
  [ErrorCodes.NOT_FOUND_GUARDIAN]: 'Guardian profile not found.',
  [ErrorCodes.NOT_FOUND_STUDENT]: 'Student record not found.',
  [ErrorCodes.NOT_FOUND_CLASSROOM]: 'Classroom not found.',
  [ErrorCodes.NOT_FOUND_BRANCH]: 'School branch/campus not found.',
  [ErrorCodes.NOT_FOUND_INVOICE]: 'Fee invoice not found.',
  [ErrorCodes.NOT_FOUND_TEMPLATE]: 'Requested document template not found.',
  [ErrorCodes.NOT_FOUND_SESSION]: 'Academic session not found.',
  [ErrorCodes.NOT_FOUND_ROUTE]: 'Transport route not found.',

  // Conflict / Duplicate
  [ErrorCodes.CONFLICT_DUPLICATE_RECORD]: 'A record with this information already exists.',
  [ErrorCodes.CONFLICT_DUPLICATE_EMAIL]: 'A user with this email address already exists.',
  [ErrorCodes.CONFLICT_DUPLICATE_PHONE]: 'A user with this phone number already exists.',
  [ErrorCodes.CONFLICT_EMPLOYEE_CODE]: 'A staff member with this employee code already exists in this school.',
  [ErrorCodes.CONFLICT_ADMISSION_NO]: 'A student with this admission number already exists in this school.',
  [ErrorCodes.CONFLICT_STUDENT_GUARDIAN]: 'This guardian is already linked to the student.',
  [ErrorCodes.CONFLICT_STATE]: 'This record was modified by another user. Please refresh and try again.',

  // Validation
  [ErrorCodes.VALIDATION_GENERAL]: 'Please check the highlighted fields and correct any errors.',
  [ErrorCodes.VALIDATION_REQUIRED]: 'This field is required.',
  [ErrorCodes.VALIDATION_EMAIL]: 'Please enter a valid email address.',
  [ErrorCodes.VALIDATION_PHONE]: 'Please enter a valid phone number (10-15 digits).',
  [ErrorCodes.VALIDATION_FORMAT]: 'The entered value does not match the expected format.',
  [ErrorCodes.VALIDATION_DATE]: 'Please provide a valid date.',
  [ErrorCodes.VALIDATION_AGE_ELIGIBILITY]: 'Child does not meet the age criteria for the selected program.',
  [ErrorCodes.VALIDATION_CSV_ROW]: 'One or more rows in your CSV contain invalid data.',

  // Business Rules
  [ErrorCodes.BUSINESS_RULE_VIOLATION]: 'The requested operation could not be completed due to business rules.',
  [ErrorCodes.BUSINESS_PARENT_LIMIT_EXCEEDED]: 'A student cannot have more than 2 primary parent accounts. Please link additional caregivers as Guardians.',
  [ErrorCodes.BUSINESS_CLASSROOM_FULL]: 'This classroom has reached its maximum student capacity.',
  [ErrorCodes.BUSINESS_FEE_ALREADY_PAID]: 'This invoice has already been paid or settled.',
  [ErrorCodes.BUSINESS_FEE_PLAN_MISSING]: 'No active fee plan found for the selected student and academic term.',
  [ErrorCodes.BUSINESS_ACADEMIC_YEAR_CLOSED]: 'The selected academic year is closed and cannot be modified.',
  [ErrorCodes.BUSINESS_ATTENDANCE_ALREADY_MARKED]: 'Attendance for this classroom and date has already been recorded.',
  [ErrorCodes.BUSINESS_PICKUP_UNAUTHORIZED]: 'This individual is not authorized for child pickup.',
  [ErrorCodes.BUSINESS_SETUP_DEPENDENCY_MISSING]: 'Required setup steps must be completed before proceeding.',
  [ErrorCodes.BUSINESS_INSUFFICIENT_STOCK]: 'Insufficient inventory stock available for this requisition.',
  [ErrorCodes.BUSINESS_OVERRIDE_REASON_REQUIRED]: 'An administrative override justification is required (minimum 5 characters).',

  // Rate Limiting
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment before trying again.',

  // System / Developer
  [ErrorCodes.SYSTEM_INTERNAL_ERROR]: 'Something went wrong on our side. Please try again or contact support.',
  [ErrorCodes.SYSTEM_SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again shortly.',
  [ErrorCodes.SYSTEM_DATABASE_ERROR]: 'An unexpected database error occurred. Reference: ',
  [ErrorCodes.SYSTEM_THIRD_PARTY_ERROR]: 'An external service provider request failed.',
  [ErrorCodes.SYSTEM_CSV_PROCESSING_ERROR]: 'Failed to process CSV data file.',
}

/**
 * Resolves a safe user-facing message for a given error code, with fallback.
 */
export function getErrorMessage(code: string, fallback?: string): string {
  return ErrorMessages[code] || fallback || 'An unexpected error occurred. Please try again.'
}
