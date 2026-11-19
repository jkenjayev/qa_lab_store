/** Whether the UI asks "Cancel this appointment?" before cancelling. */
export function needsConfirmation(defects) {
  // CB_NO_CANCEL_CONFIRM (Cancel has no confirmation dialog)
  return !defects.CB_NO_CANCEL_CONFIRM;
}
