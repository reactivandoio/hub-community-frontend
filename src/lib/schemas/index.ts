export {
  changePasswordSchema,
  emailSchema,
  passwordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  strongPasswordSchema,
  usernameSchema,
  type ChangePasswordFormValues,
  type ResetPasswordFormValues,
  type SignInFormValues,
  type SignUpFormValues,
} from './auth.schema';

// User schemas
export {
  certificateSearchSchema,
  cpfSchema,
  eventRegistrationSchema,
  fullNameSchema,
  isValidCPF,
  optionalPhoneSchema,
  phoneSchema,
  userProfileSchema,
  type CertificateSearchFormValues,
  type EventRegistrationFormValues,
  type UserProfileFormValues,
} from './user.schema';

// Community schemas
export {
  createCommunitySchema,
  editCommunitySchema,
  fullDescriptionSchema,
  generateSlugFromTitle,
  shortDescriptionSchema,
  slugSchema,
  titleSchema,
  type CreateCommunityFormValues,
  type EditCommunityFormValues,
} from './community.schema';

// Event schemas
export {
  batchSchema,
  createEventSchema,
  dateSchema,
  editEventSchema,
  locationSchema,
  maxSlotsSchema,
  optionalDateSchema,
  productSchema,
  speakerSchema,
  talkSchema,
  votingOptionSchema,
  votingSessionSchema,
  type BatchFormValues,
  type CreateEventFormValues,
  type EditEventFormValues,
  type LocationFormValues,
  type ProductFormValues,
  type SpeakerFormValues,
  type TalkFormValues,
  type VotingOptionFormValues,
  type VotingSessionFormValues,
} from './event.schema';
