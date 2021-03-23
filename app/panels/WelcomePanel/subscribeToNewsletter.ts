// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
export default async function subscribeToNewsletter(email: string): Promise<void> {
  if (process.env.SIGNUP_API_URL != undefined) {
    const response = await fetch(process.env.SIGNUP_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.status !== 200) {
      throw new Error("We were unable to process your signup request. Sorry!");
    }
  }
}
