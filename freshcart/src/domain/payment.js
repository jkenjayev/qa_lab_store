/** Test card from the Notion design that the mock provider declines. */
export const DECLINE_CARD = '4000000000000002';

/**
 * Mock payment provider. The real provider sandbox keys have not arrived (feature F2.5 is blocked),
 * so this stands in with two hard-coded rules.
 */
export class MockPaymentGateway {
  constructor({ defects }) {
    this.defects = defects;
  }

  async charge({ number }) {
    const digits = String(number).replace(/\D/g, '');
    // FC_DECLINE_SHOWS_CONFIRMATION: "Declined test card shows the confirmation page" - the mock always approves.
    if (digits === DECLINE_CARD && !this.defects.FC_DECLINE_SHOWS_CONFIRMATION) {
      return { approved: false };
    }
    return { approved: true, last4: digits.slice(-4) };
  }
}
