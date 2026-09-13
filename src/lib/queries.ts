import { gql } from '@apollo/client';

export const GET_COMMUNITIES = gql`
  query GetCommunities($filters: CommunityFilter) {
    communities(filters: $filters) {
      data {
        id
        title
        short_description
        full_description
        members_quantity
        images
        slug
        organizers {
          id
          username
          email
        }
        events {
          id
          title
          start_date
        }
        tags {
          id
          value
        }
        links {
          id
          url
        }
      }
    }
  }
`;

export const GET_COMMUNITY_BY_ID = gql`
  query GetCommunityById($id: String!) {
    community(id: $id) {
      id
      slug
      title
      short_description
      full_description
      members_quantity
      images
      organizers {
        id
        username
        email
      }
      events {
        id
        documentId
        slug
        title
        start_date
        end_date
      }
      tags {
        id
        value
      }
      links {
        id
        name
        url
      }
    }
  }
`;

export const GET_COMMUNITY_BY_SLUG_OR_ID = gql`
  query GetCommunityBySlugOrId($slugOrId: String!) {
    communityBySlugOrId(slugOrId: $slugOrId) {
      id
      slug
      title
      short_description
      full_description
      members_quantity
      images
      organizers {
        id
        username
        email
      }
      events {
        id
        documentId
        slug
        title
        start_date
        end_date
        images
        location {
          title
          city
        }
        talks {
          id
        }
      }
      tags {
        id
        value
      }
      links {
        id
        name
        url
      }
    }
  }
`;

export const GET_EVENTS = gql`
  query GetEvents($filters: EventFilter, $sort: [EventSort]) {
    events(filters: $filters, sort: $sort) {
      data {
        id
        documentId
        slug
        title
        description
        start_date
        end_date
        images
        communities {
          id
          slug
          title
          short_description
          full_description
        }
        talks {
          id
          documentId
          title
          speakers {
            id
            name
            avatar
          }
        }
        location {
          title
          region
          latitude
          longitude
          google_maps_url
          full_address
          city
        }
      }
    }
  }
`;

export const GET_TAGS = gql`
  query GetTags {
    tags {
      data {
        id
        value
        events {
          id
          title
        }
        communities {
          id
          title
        }
      }
    }
  }
`;

export const GET_LOCATIONS = gql`
  query GetLocations {
    locations {
      data {
        id
        title
        region
        latitude
        longitude
        google_maps_url
        full_address
        city
      }
    }
  }
`;

export const GET_EVENT_BY_SLUG_OR_ID = gql`
  query GetEventBySlugOrId($slugOrId: String!) {
    eventBySlugOrId(slugOrId: $slugOrId) {
      id
      documentId
      slug
      title
      description
      start_date
      end_date
      images
      max_slots
      subscription_link
      is_online
      call_link
      communities {
        id
        slug
        title
        short_description
        full_description
        images
      }
      talks {
        id
        documentId
        title
        description
        room_description
        highlight
        occur_date
        speakers {
          id
          name
          avatar
        }
      }
      products {
        id
        enabled
        name
        batches {
          id
          batch_number
          value
          max_quantity
          enabled
          half_price_eligible
        }
      }
      location {
        id
        title
        region
        latitude
        longitude
        google_maps_url
        full_address
        city
      }
    }
  }
`;

// Event Signup Mutations & Queries
export const SIGNUP_TO_EVENT = gql`
  mutation SignupToEvent(
    $eventId: String!
    $name: String!
    $email: String!
    $batch_id: String!
    $coupon_code: String
    $is_student: Boolean
    $phone_number: String
  ) {
    signupToEvent(
      eventId: $eventId
      name: $name
      email: $email
      batch_id: $batch_id
      coupon_code: $coupon_code
      is_student: $is_student
      phone_number: $phone_number
    ) {
      success
      message
      payment
      is_free
    }
  }
`;

export const IS_USER_SIGNED_UP = gql`
  query IsUserSignedUp($eventId: String!, $email: String!) {
    isUserSignedUp(eventId: $eventId, email: $email) {
      is_signed_up
      call_link
    }
  }
`;

export const VALIDATE_COUPON = gql`
  query ValidateCoupon($eventSlug: String!, $code: String!) {
    validateCoupon(eventSlug: $eventSlug, code: $code) {
      valid
      discount_percentage
      message
    }
  }
`;

// Authentication Mutations
export const SIGN_UP = gql`
  mutation SignUp($input: UserInput!) {
    signUp(input: $input) {
      email
      username
      name
      phone
    }
  }
`;

export const SIGN_IN = gql`
  mutation SignIn($identifier: String!, $password: String!) {
    signIn(identifier: $identifier, password: $password) {
      token
      email
      username
      name
      phone
      cpf
      date_of_birth
      id
    }
  }
`;

// The authenticated user's own profile, read fresh from the server.
export const ME = gql`
  query Me {
    me {
      id
      username
      email
      name
      phone
      cpf
      date_of_birth
    }
  }
`;

export const FORWARD_PASSWORD = gql`
  mutation ForwardPassword($email: String!) {
    forwardPassword(email: $email)
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($code: String!, $password: String!, $passwordConfirmation: String!) {
    resetPassword(code: $code, password: $password, passwordConfirmation: $passwordConfirmation)
  }
`;

export const UPDATE_USER_PHONE = gql`
  mutation UpdateUserPhone($email: String!, $phone: String!) {
    updateUserPhone(email: $email, phone: $phone) {
      id
      username
      email
      phone
    }
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: ProfileInput!) {
    updateProfile(input: $input) {
      id
      username
      email
      name
      phone
      cover_photo
      twitter
      linkedin
      github
      website
      instagram
    }
  }
`;

export const GET_TALK_BY_ID = gql`
  query GetTalkById($talkId: String!) {
    talk(id: $talkId) {
      id
      title
      description
      subtitle
      room_description
      highlight
      speakers {
        id
        name
        avatar
        biography
      }
      event {
        id
        title
        start_date
        end_date
        images
        location {
          title
          region
          latitude
          longitude
          google_maps_url
          full_address
          city
        }
        communities {
          id
          slug
          title
          short_description
          images
        }
      }
    }
  }
`;

export const GET_AGENDAS = gql`
  query GetAgendas {
    agendas {
      data {
        documentId
        event {
          documentId
          title
          images
        }
      }
    }
  }
`;

export const GET_AGENDA_BY_ID = gql`
  query GetAgendaById($agendaId: String!) {
    agenda(id: $agendaId) {
      talks {
        documentId
        title
        subtitle
        occur_date
      }
    }
  }
`;

// Agenda Mutations
export const CREATE_AGENDA = gql`
  mutation CreateAgenda($input: AgendaInput!) {
    createAgenda(input: $input) {
      documentId
    }
  }
`;

export const UPDATE_AGENDA = gql`
  mutation UpdateAgenda($updateAgendaId: String!, $input: AgendaUpdateInput!) {
    updateAgenda(id: $updateAgendaId, input: $input) {
      documentId
      event {
        title
      }
    }
  }
`;

// Query to get agenda by event ID
export const GET_AGENDA_BY_EVENT_ID = gql`
  query GetAgendaByEventId($eventId: String!) {
    agendas(filters: { event: { documentId: { eq: $eventId } } }) {
      data {
        documentId
        talks {
          documentId
        }
      }
    }
  }
`;

// Comment Queries and Mutations
export const CREATE_COMMENT = gql`
  mutation CreateComment($input: CommentInput!) {
    createComment(input: $input) {
      comment
    }
  }
`;

export const GET_COMMENTS = gql`
  query GetComments($talkId: String!) {
    comments(
      filters: { talk: { documentId: { eq: $talkId } } }
      populate: ["talk", "user_creator"]
    ) {
      data {
        comment
        talk {
          title
        }
        user {
          username
        }
      }
    }
  }
`;

export const GET_USER_BY_USERNAME = gql`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      username
      email
      name
      phone
      cover_photo
      twitter
      linkedin
      github
      website
      instagram
      speaker {
        avatar
      }
      agenda {
        documentId
        event {
          documentId
          title
          images
        }
      }
    }
  }
`;

// Event Management Mutations
export const CREATE_EVENT = gql`
  mutation CreateEvent($data: EventInput!) {
    createEvent(data: $data) {
      id
      title
      slug
    }
  }
`;

export const UPDATE_EVENT = gql`
  mutation UpdateEvent($id: String!, $data: EventInput!) {
    updateEvent(id: $id, data: $data) {
      id
      title
      slug
    }
  }
`;

export const DELETE_EVENT = gql`
  mutation DeleteEvent($id: String!) {
    deleteEvent(id: $id) {
      id
    }
  }
`;

export const UPDATE_EVENT_SALE = gql`
  mutation UpdateEventSale($id: String!, $data: EventSaleInput!) {
    updateEventSale(id: $id, data: $data) {
      id
      products {
        id
        name
        enabled
        batches {
          id
          batch_number
          value
          max_quantity
          enabled
        }
      }
    }
  }
`;

export const CREATE_LOCATION = gql`
  mutation CreateLocation($data: LocationInput!) {
    createLocation(data: $data) {
      id
      title
      city
      region
      full_address
      google_maps_url
      latitude
      longitude
    }
  }
`;

export const CREATE_COMMUNITY = gql`
  mutation CreateCommunity($data: CommunityInput!) {
    createCommunity(data: $data) {
      id
      title
      slug
    }
  }
`;

export const CREATE_SPEAKER = gql`
  mutation CreateSpeaker($data: SpeakerInput!) {
    createSpeaker(data: $data) {
      id
      name
    }
  }
`;

export const GET_SPEAKERS = gql`
  query GetSpeakers($filters: SpeakerFilter, $sort: [SpeakerSort], $pagination: PaginationInput, $search: String) {
    speakers(filters: $filters, sort: $sort, pagination: $pagination, search: $search) {
      data {
        id
        name
        avatar
        highlight
        biography
        talks {
          id
          title
        }
      }
      meta {
        total
        page
        pageSize
        pageCount
      }
    }
  }
`;

export const CREATE_TALK = gql`
  mutation CreateTalk($data: TalkInput!) {
    createTalk(data: $data) {
      id
      title
      speakers {
        name
        id
      }
    }
  }
`;

export const UPDATE_TALK = gql`
  mutation UpdateTalk($updateTalkId: String!, $data: TalkInput!) {
    updateTalk(id: $updateTalkId, data: $data) {
      id
      title
      occur_date
      description
      speakers {
        name
        id
      }
    }
  }
`;

export const DELETE_SPEAKER = gql`
  mutation DeleteSpeaker($id: String!) {
    deleteSpeaker(id: $id) {
      id
      name
    }
  }
`;

export const UPDATE_SPEAKER = gql`
  mutation UpdateSpeaker($id: String!, $data: SpeakerInput!) {
    updateSpeaker(id: $id, data: $data) {
      id
      name
      avatar
      highlight
      biography
    }
  }
`;

export const GET_EVENT_ANALYTICS = gql`
  query GetEventAnalytics($slugOrId: String!) {
    eventAnalytics(slugOrId: $slugOrId) {
      event_id
      event_title
      event_slug
      total_signups
      free_signups
      paid_signups
      max_slots
      occupancy_percentage
      certificate_requests
      products_breakdown {
        product_id
        product_name
        total_signups
        batches {
          batch_id
          batch_number
          value
          max_quantity
          sold_quantity
          revenue
        }
      }
      signups_timeline {
        date
        count
      }
      all_signups {
        name
        email
        phone_number
        created_at
        product_name
      }
    }
  }
`;

export const TRACK_EVENT = gql`
  mutation TrackEvent($input: TrackEventInput!) {
    trackEvent(input: $input) {
      success
      id
    }
  }
`;

export const GET_EVENT_TRACKING_METRICS = gql`
  query GetEventTrackingMetrics($eventDocumentId: String!, $period: String) {
    eventTrackingMetrics(eventDocumentId: $eventDocumentId, period: $period) {
      total_visits
      unique_visitors
      signup_clicks
      share_clicks
      visits_by_day {
        date
        count
      }
      visits_by_referrer {
        referrer
        count
      }
    }
  }
`;

export const DELETE_COMMUNITY = gql`
  mutation DeleteCommunity($id: String!) {
    deleteCommunity(id: $id) {
      id
    }
  }
`;

// Checkin / Credentialing
export const EVENT_SIGNUPS = gql`
  query EventSignups($eventSlug: String!, $search: String) {
    eventSignups(eventSlug: $eventSlug, search: $search) {
      id
      name
      email
      phone_number
      checked_in
      checked_in_at
      product_name
    }
  }
`;

export const CHECKIN_SIGNUP = gql`
  mutation CheckinSignup($eventSlug: String!, $signupId: String!) {
    checkinSignup(eventSlug: $eventSlug, signupId: $signupId) {
      success
      message
      signup {
        id
        name
        email
        phone_number
        checked_in
        checked_in_at
        product_name
      }
    }
  }
`;

export const CREDENTIAL_CHECKED_IN = gql`
  subscription CredentialCheckedIn($eventSlug: String!) {
    credentialCheckedIn(eventSlug: $eventSlug) {
      id
      name
      email
      phone_number
      checked_in
      checked_in_at
      product_name
    }
  }
`;

export const IMPORT_SIGNUPS = gql`
  mutation ImportSignups($eventSlug: String!, $batchId: String!, $signups: [SignupImportInput!]!) {
    importSignups(eventSlug: $eventSlug, batchId: $batchId, signups: $signups) {
      success
      message
      imported_count
      skipped_count
      errors
    }
  }
`;

export const MANUAL_SIGNUP = gql`
  mutation ManualSignup($eventSlug: String!, $batchId: String!, $input: ManualSignupInput!) {
    manualSignup(eventSlug: $eventSlug, batchId: $batchId, input: $input) {
      success
      message
      account_created
      signup {
        id
        name
        email
        phone_number
        checked_in
        checked_in_at
        product_name
      }
    }
  }
`;

// Just what the badge printer needs to register a walk-in: the event's batches.
export const EVENT_BATCHES = gql`
  query EventBatches($slugOrId: String!) {
    eventBySlugOrId(slugOrId: $slugOrId) {
      id
      title
      products {
        id
        name
        enabled
        batches {
          id
          batch_number
          value
          enabled
        }
      }
    }
  }
`;

// Attendance (Lista de Presença)
export const GET_EVENT_ATTENDANCES = gql`
  query GetEventAttendances($eventDocumentId: String!) {
    eventAttendances(eventDocumentId: $eventDocumentId) {
      id
      user {
        id
        name
        email
        phone
        cpf
        date_of_birth
      }
      createdAt
    }
  }
`;

export const CREATE_ATTENDANCE = gql`
  mutation CreateAttendance(
    $eventDocumentId: String!
    $cpf: String!
    $date_of_birth: String!
    $phone: String!
    $name: String!
  ) {
    createAttendance(
      eventDocumentId: $eventDocumentId
      cpf: $cpf
      date_of_birth: $date_of_birth
      phone: $phone
      name: $name
    ) {
      success
      message
    }
  }
`;

// Certificates (certificado de participação)
export const CERTIFICATE_FIELDS = gql`
  fragment CertificateFields on Certificate {
    id
    code
    name
    identifier
    email
    source
    issued_at
    sent_at
    revoked_at
    event {
      id
      documentId
      slug
      title
      start_date
      end_date
      is_online
      location {
        title
        city
      }
      communities {
        title
      }
    }
  }
`;

// Subset of CERTIFICATE_FIELDS without `identifier`/`email`: used by public pages
// (GET_CERTIFICATE_BY_CODE) that must never fetch CPF/e-mail.
export const CERTIFICATE_PUBLIC_FIELDS = gql`
  fragment CertificatePublicFields on Certificate {
    id
    code
    name
    source
    issued_at
    sent_at
    revoked_at
    event {
      id
      documentId
      slug
      title
      start_date
      end_date
      is_online
      location {
        title
        city
      }
      communities {
        title
      }
    }
  }
`;

export const CERTIFICATE_CONFIG_FIELDS = gql`
  fragment CertificateConfigFields on CertificateConfig {
    id
    enabled
    allow_self_request
    title
    body_template
    workload_hours
    issuer_name
    primary_color
    logo
    logo_id
    background
    background_id
    sponsors {
      name
      logo
      logo_id
      url
    }
    signatures {
      name
      role
      image
      image_id
      text
      font
    }
  }
`;

export const GET_CERTIFICATE_CONFIG = gql`
  ${CERTIFICATE_CONFIG_FIELDS}
  query GetCertificateConfig($eventId: String!) {
    certificateConfig(eventId: $eventId) {
      ...CertificateConfigFields
    }
  }
`;

export const GET_CERTIFICATE_BY_CODE = gql`
  ${CERTIFICATE_PUBLIC_FIELDS}
  query GetCertificateByCode($code: String!) {
    certificateByCode(code: $code) {
      ...CertificatePublicFields
    }
  }
`;

export const LOOKUP_CERTIFICATE = gql`
  ${CERTIFICATE_FIELDS}
  query LookupCertificate($eventId: String!, $identifier: String!) {
    lookupCertificate(eventId: $eventId, identifier: $identifier) {
      certificate {
        ...CertificateFields
      }
      eligible_by_attendance
      self_request_allowed
      event_ended
      revoked
    }
  }
`;

export const UPSERT_CERTIFICATE_CONFIG = gql`
  ${CERTIFICATE_CONFIG_FIELDS}
  mutation UpsertCertificateConfig($eventId: String!, $data: CertificateConfigInput!) {
    upsertCertificateConfig(eventId: $eventId, data: $data) {
      ...CertificateConfigFields
    }
  }
`;

// Every event that has a certificate model — the source list for copying one.
export const CERTIFICATE_CONFIGS = gql`
  ${CERTIFICATE_CONFIG_FIELDS}
  query CertificateConfigs {
    certificateConfigs {
      event {
        id
        slug
        title
        start_date
      }
      config {
        ...CertificateConfigFields
      }
    }
  }
`;

export const COPY_CERTIFICATE_CONFIG = gql`
  ${CERTIFICATE_CONFIG_FIELDS}
  mutation CopyCertificateConfig($fromEventId: String!, $toEventId: String!) {
    copyCertificateConfig(fromEventId: $fromEventId, toEventId: $toEventId) {
      ...CertificateConfigFields
    }
  }
`;

export const REQUEST_CERTIFICATE = gql`
  ${CERTIFICATE_FIELDS}
  mutation RequestCertificate(
    $eventId: String!
    $name: String!
    $identifier: String!
    $email: String!
    $phone: String
  ) {
    requestCertificate(
      eventId: $eventId
      name: $name
      identifier: $identifier
      email: $email
      phone: $phone
    ) {
      ...CertificateFields
    }
  }
`;

export const GET_CERTIFICATE_CANDIDATES = gql`
  query GetCertificateCandidates($eventId: String!) {
    certificateCandidates(eventId: $eventId) {
      key
      name
      email
      identifier
      phone
      sources
      checked_in
      certificate {
        id
        code
        name
        source
        issued_at
        sent_at
      }
    }
  }
`;

export const ISSUE_CERTIFICATES = gql`
  mutation IssueCertificates($eventId: String!, $entries: [IssueEntryInput!]!, $actions: IssueActionsInput!) {
    issueCertificates(eventId: $eventId, entries: $entries, actions: $actions) {
      issued
      emailed
      errors
      certificates {
        code
        identifier
        sent_at
      }
    }
  }
`;
