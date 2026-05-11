export { isLocalSupabaseUrl } from './env'
export {
  fireAndForgetWelcomeEmail,
  invokeEmailEdgeFunction,
  sendMatterEmailTest,
  sendNotificationEmailNow,
  sendOfferByEmail,
  sendWelcomeEmailForPendingInvite,
} from './supabaseEdgeEmail'
export type {
  EmailEdgeInvokeFailure,
  SendNotificationEmailResponse,
  SendOfferEmailResponse,
  SendTestEmailResponse,
  SendWelcomeEmailResponse,
} from './supabaseEdgeEmail'
