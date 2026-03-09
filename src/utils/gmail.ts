// Gmail API helper for sending emails via Google OAuth

type GmailEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_ACCESS_TOKEN?: string;
};

// Refresh access token if needed
async function getAccessToken(env: GmailEnv): Promise<string | null> {
  if (!env.GOOGLE_REFRESH_TOKEN || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error('Missing Google OAuth credentials');
    return null;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    const data = await res.json() as { access_token?: string; error?: string };
    if (data.access_token) {
      return data.access_token;
    }
    console.error('Token refresh failed:', data.error);
    return null;
  } catch (e) {
    console.error('Token refresh error:', e);
    return null;
  }
}

// RFC 2047 encode subject for proper UTF-8/emoji support
function encodeSubject(subject: string): string {
  // Use Base64 encoding for the subject to handle emojis properly
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

// Encode email to base64url format for Gmail API
function encodeEmail(to: string, from: string, subject: string, html: string): string {
  const encodedSubject = encodeSubject(subject);
  
  const email = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n');

  // Base64url encode the entire message
  const encoder = new TextEncoder();
  const bytes = encoder.encode(email);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Send email via Gmail API
export async function sendGmail(
  env: GmailEnv,
  to: string,
  subject: string,
  html: string,
  fromName: string = 'The Handy Beaver'
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getAccessToken(env);
  if (!accessToken) {
    return { success: false, error: 'Failed to get access token' };
  }

  const from = `${fromName} <serviceflowagi@gmail.com>`;
  const raw = encodeEmail(to, from, subject, html);

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (res.ok) {
      const data = await res.json() as { id: string };
      console.log('Email sent via Gmail, message ID:', data.id);
      return { success: true };
    } else {
      const error = await res.text();
      console.error('Gmail API error:', error);
      return { success: false, error };
    }
  } catch (e) {
    console.error('Gmail send error:', e);
    return { success: false, error: String(e) };
  }
}
