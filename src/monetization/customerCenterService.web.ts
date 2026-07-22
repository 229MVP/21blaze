export type CustomerCenterResult =
  | { status: 'opened' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

export async function presentCustomerCenter(
  _appUserId: string,
): Promise<CustomerCenterResult> {
  return {
    status: 'unavailable',
    message:
      'Customer Center requires a native development build. Unavailable on Expo Web.',
  };
}
