/**
 * Former local order/activity creation state.
 * New order drafts now leave the UI through NewOrderDialog.onSubmitDraft without
 * generated IDs, timestamps, orders, or audit records.
 */
export const mockOrderSubmissionBehavior = "removed" as const;
