import { BlocksContent } from '@strapi/blocks-react-renderer';

export interface Community {
  id: string;
  slug?: string;
  title: string;
  short_description: string | BlocksContent;
  full_description: string | BlocksContent;
  members_quantity: number;
  organizers: string[];
  events: Event[];
  tags: Tag[];
  images?: string[];
  links?: Link[];
}

export interface CommunityDetail {
  id: string;
  slug?: string;
  title: string;
  short_description: string | BlocksContent;
  full_description: string | BlocksContent;
  members_quantity: number;
  images?: string[];
  location?: string;
  founded_date?: string;
  website?: string;
  github?: string;
  twitter?: string;
  linkedin?: string;
  organizers: Organizer[];
  events: Event[];
  tags: Tag[];
  links?: Link[];
}

export interface Organizer {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface Tag {
  id: string;
  value: string;
}

export interface Link {
  id: string;
  name: string;
  url: string;
  social_media: string;
}

export interface Speaker {
  id: string;
  name: string;
  avatar?: string;
  biography?: string | BlocksContent;
  highlight?: boolean;
  talks?: { id: string; title: string }[];
  socials?: Link[];
}

export interface Talk {
  id: string;
  documentId?: string;
  subtitle?: string;
  title: string;
  description?: string | BlocksContent;
  room_description?: string;
  highlight?: boolean;
  occur_date?: string;
  speakers: Speaker[];
}

export interface EventLocation {
  id?: string;
  title?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  full_address?: string;
  city?: string;
}

export interface Event {
  id: string;
  documentId?: string;
  slug?: string;
  title: string;
  description?: string | BlocksContent;
  start_date: string;
  end_date: string;
  images?: string[];
  subscription_link?: string;
  pixai_token_integration?: string;
  is_online?: boolean;
  call_link?: string;
  communities: {
    id: string;
    title: string;
    short_description: string | BlocksContent;
    full_description: string | BlocksContent;
    images?: string[];
  }[];
  talks: Talk[];
  location?: EventLocation;
  products?: Product[];
  max_slots?: number;
}

export interface Batch {
  id?: string;
  batch_number: number;
  value: number;
  max_quantity?: number;
  valid_from: string;
  valid_until: string;
  enabled: boolean;
  half_price_eligible: boolean;
}

export interface Product {
  id?: string;
  enabled: boolean;
  name: string;
  batches: Batch[];
}

export interface CommunitiesResponse {
  communities?: {
    data: Community[];
  };
}

export interface CommunityResponse {
  community?: CommunityDetail;
  communityBySlugOrId?: CommunityDetail;
}

export interface EventsResponse {
  events?: {
    data: Event[];
  };
}

export interface TagsResponse {
  tags?: {
    data: Tag[];
  };
}

export interface EventResponse {
  eventBySlugOrId: Event;
}

export interface TalkResponse {
  talk: Talk & {
    event: Event;
  };
}

// Auth Types
export interface User {
  id?: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  phone?: string;
  social_security_number?: string;
}

export interface SignUpInput {
  email: string;
  name: string;
  password: string;
  username: string;
  phone?: string;
  social_security_number?: string;
}

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface SignInResponse {
  signIn: {
    token: string;
    email: string;
    username: string;
    name: string;
    phone: string;
    id: string;
  };
}

export interface SignUpResponse {
  signUp: {
    email: string;
    username: string;
  };
}

export interface ForwardPasswordResponse {
  forwardPassword: boolean;
}

export interface ResetPasswordResponse {
  resetPassword: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showLogoutModal: boolean;
}

export interface AuthContextType extends AuthState {
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => void;
  forwardPassword: (email: string) => Promise<void>;
  resetPassword: (code: string, password: string, passwordConfirmation: string) => Promise<void>;
  updatePhone: (phone: string) => Promise<void>;
  syncUser: (data: Partial<User>) => void;
  validateToken: () => boolean;
  showLogoutAlert: () => void;
  hideLogoutAlert: () => void;
}

// Public user profile (matches userByUsername API)
export interface UserProfile {
  username: string;
  email?: string;
  speaker?: { avatar?: string };
  agenda?: { event: { title: string; images?: string[] } }[];
}

export interface UserProfileResponse {
  userByUsername?: UserProfile | null;
}

// Agenda Types
export interface AgendaEvent {
  documentId: string;
  title: string;
  images?: string[];
}

export interface Agenda {
  documentId: string;
  event: AgendaEvent;
}

export interface AgendasResponse {
  agendas: {
    data: Agenda[];
  };
}

export interface AgendaTalk {
  documentId: string;
  title: string;
  subtitle: string;
  occur_date: string;
}

export interface AgendaDetail {
  talks: AgendaTalk[];
}

export interface AgendaDetailResponse {
  agenda: AgendaDetail;
}

export interface AgendaContextType {
  agendas: Agenda[];
  isLoading: boolean;
  refetchAgendas: () => Promise<void>;
}

// Comment Types
export interface CommentNode {
  type: 'text' | 'paragraph' | 'heading' | 'list' | 'list-item' | 'quote';
  text?: string;
  children?: CommentNode[];
  level?: number;
}

export interface CommentData {
  type: 'paragraph' | 'heading' | 'list' | 'quote';
  children: CommentNode[];
}

export interface Comment {
  id?: string;
  comment: CommentData[];
  talk?: {
    title: string;
  };
  user?: {
    username: string;
  };
}

export interface CommentInput {
  talk_id: string;
  comment: CommentData[];
}

export interface CreateCommentResponse {
  createComment: {
    comment: CommentData[];
  };
}

export interface CommentsResponse {
  comments: {
    data: Comment[];
  };
}

export interface EventInput {
  title: string;
  slug: string;
  description?: string | BlocksContent;
  start_date: string;
  end_date: string;
  max_slots?: number;
  pixai_token_integration?: string;
  is_online?: boolean;
  call_link?: string;
  products?: string[]; // IDs of products
  communities?: string[]; // IDs of communities
  location?: string; // ID of location
  images?: string[]; // IDs/String representation of images
  talks?: string[]; // IDs of talks
}

export interface CreateEventResponse {
  createEvent: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface UpdateEventResponse {
  updateEvent: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface DeleteEventResponse {
  deleteEvent: {
    id: string;
  };
}

export interface EventSaleInput {
  max_slots?: number;
  products?: {
    name: string;
    enabled: boolean;
    batches?: {
      batch_number: number;
      value: number;
      max_quantity: number;
      valid_from?: string;
      valid_until?: string;
      enabled?: boolean;
      half_price_eligible?: boolean;
    }[];
  }[];
}

export interface UpdateEventSaleResponse {
  updateEventSale: {
    id: string;
    products: Product[];
  };
}

export interface CommunityInput {
  title: string;
  slug: string;
  short_description?: string | BlocksContent;
  full_description?: string | BlocksContent;
  members_quantity?: number;
}

export interface CreateCommunityResponse {
  createCommunity: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface SpeakerInput {
  name: string;
  biography?: string | BlocksContent;
  avatar?: string;
}

export interface CreateSpeakerResponse {
  createSpeaker: {
    id: string;
    name: string;
  };
}

export interface SpeakersResponse {
  speakers: {
    data: Speaker[];
  };
}

export interface TalkInput {
  title: string;
  subtitle?: string;
  description?: any[];
  speakers?: string[];
  occur_date: string;
  event: string;
  room_description?: string;
  highlight?: boolean;
}

export interface CreateTalkResponse {
  createTalk: {
    id: string;
    title: string;
    speakers: Speaker[];
  };
}

export interface UpdateTalkResponse {
  updateTalk: {
    id: string;
    title: string;
    occur_date: string;
    description: any[];
    speakers: Speaker[];
  };
}

export interface VotingOption {
  id: number;
  documentId: string;
  name: string;
  description?: string;
  pitch_order: number;
  voting_session?: VotingSession; // reference
}

export interface VotingSession {
  id: number;
  documentId: string;
  title: string;
  description?: string;
  event_id?: string;
  status: 'open' | 'closed' | 'archived';
  max_votes_per_user: number;
  voting_options?: VotingOption[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface VotingSessionInput {
  title: string;
  description?: string;
  event_id?: string;
  status: 'open' | 'closed' | 'archived';
  max_votes_per_user: number;
}

export interface VotingSessionsResponse {
  data: VotingSession[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    }
  };
}

export interface VotingSessionResponse {
  data: VotingSession;
}

// Event Analytics types
export interface BatchAnalytics {
  batch_id: string;
  batch_number: number;
  value: number;
  max_quantity: number;
  sold_quantity: number;
  revenue: number;
}

export interface ProductAnalytics {
  product_id: string;
  product_name: string;
  total_signups: number;
  batches: BatchAnalytics[];
}

export interface TimelineDataPoint {
  date: string;
  count: number;
}

export interface SignupEntry {
  name: string;
  email: string;
  phone_number: string;
  created_at: string;
  product_name: string;
}

export interface EventAnalytics {
  event_id: string;
  event_title: string;
  event_slug: string;
  total_signups: number;
  free_signups: number;
  paid_signups: number;
  max_slots: number | null;
  occupancy_percentage: number | null;
  certificate_requests: number;
  products_breakdown: ProductAnalytics[];
  signups_timeline: TimelineDataPoint[];
  all_signups: SignupEntry[];
}

export interface EventAnalyticsResponse {
  eventAnalytics: EventAnalytics;
}

// Checkin / Credentialing types
export interface EventSignup {
  id: string;
  name: string;
  email?: string;
  phone_number?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  product_name?: string;
}

export interface CheckinResponse {
  success: boolean;
  message?: string;
  signup?: EventSignup;
}

export interface EventSignupsResponse {
  eventSignups: EventSignup[];
}

export interface CheckinSignupResponse {
  checkinSignup: CheckinResponse;
}

export interface CredentialCheckedInData {
  credentialCheckedIn: EventSignup;
}

export interface ImportSignupsResponse {
  importSignups: {
    success: boolean;
    message?: string;
    imported_count: number;
    skipped_count: number;
    errors?: string[];
  };
}

export interface ManualSignupResponse {
  manualSignup: {
    success: boolean;
    message?: string;
    account_created: boolean;
  };
}
