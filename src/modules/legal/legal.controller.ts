import { Controller, Get, Header } from '@nestjs/common';

const EFFECTIVE_DATE = '2026-04-16';

@Controller('legal')
export class LegalController {
  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getTermsOfService() {
    return this.renderPage(
      'Terms of Service',
      `
        <p>Effective date: ${EFFECTIVE_DATE}</p>
        <p>Kanban Discord Bot is a Discord-based task and workflow application. By installing or using the application, you agree to these terms.</p>

        <h2>Use of the Service</h2>
        <p>You may use the application only in compliance with Discord's terms, applicable laws, and these terms. You are responsible for the content, users, and server configuration connected to your installation.</p>

        <h2>Acceptable Use</h2>
        <p>You may not use the application to violate laws, abuse Discord services, interfere with the operation of the application, or submit harmful, unlawful, or unauthorized content.</p>

        <h2>Accounts and Discord Servers</h2>
        <p>The application operates through Discord servers and user accounts. Server owners and administrators are responsible for role mappings, permissions, and channel configuration inside their servers.</p>

        <h2>Data and Availability</h2>
        <p>The application stores task, workflow, and configuration data needed to operate. Service availability is provided on an as-is basis without any uptime guarantee.</p>

        <h2>Termination</h2>
        <p>Access may be suspended or terminated at any time if use of the application creates legal, security, or operational risk.</p>

        <h2>Disclaimer of Warranties</h2>
        <p>The application is provided "as is" and "as available" without warranties of any kind, express or implied.</p>

        <h2>Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, the application provider is not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or business interruption resulting from use of the application.</p>

        <h2>Changes</h2>
        <p>These terms may be updated from time to time. Continued use after changes take effect constitutes acceptance of the updated terms.</p>

        <h2>Contact</h2>
        <p>For questions about these terms, contact the application operator through the support channel or contact address you publish with the deployed service.</p>
      `,
    );
  }

  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy() {
    return this.renderPage(
      'Privacy Policy',
      `
        <p>Effective date: ${EFFECTIVE_DATE}</p>
        <p>This Privacy Policy explains what data Kanban Discord Bot processes, why it processes that data, and how that data is handled.</p>

        <h2>Data We Process</h2>
        <p>The application may process Discord server identifiers, channel identifiers, role identifiers, user identifiers, task content, assignment metadata, workflow activity, and reminder settings required to provide task management features.</p>

        <h2>How Data Is Used</h2>
        <p>Data is used only to operate the application's Discord task workflow features, including command handling, task storage, assignment, workflow transitions, and deadline reminders.</p>

        <h2>Data Sharing</h2>
        <p>The application does not sell personal data. Data may be shared only with infrastructure providers used to host the service, or when required by law.</p>

        <h2>Data Retention</h2>
        <p>Data is retained for as long as needed to operate the service, maintain server task history, comply with legal obligations, or resolve security and abuse issues. Server owners may remove the application and request deletion of associated data where applicable.</p>

        <h2>Security</h2>
        <p>Reasonable technical and organizational measures should be used to protect application data, but no system can guarantee absolute security.</p>

        <h2>Your Choices</h2>
        <p>Server owners and administrators control whether the application is installed and how it is configured in a server. Users may contact the application operator regarding privacy requests applicable to their data.</p>

        <h2>Children's Privacy</h2>
        <p>The application is not intended for children under the age required by applicable law or Discord policy.</p>

        <h2>Changes</h2>
        <p>This Privacy Policy may be updated from time to time. Continued use after changes take effect constitutes acceptance of the updated policy.</p>

        <h2>Contact</h2>
        <p>For privacy questions or requests, contact the application operator through the support channel or contact address you publish with the deployed service.</p>
      `,
    );
  }

  private renderPage(title: string, body: string) {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} | Kanban Discord Bot</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --surface: #fffdf8;
        --text: #1e1b16;
        --muted: #5f584d;
        --accent: #0f766e;
        --border: #ded6c8;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.10), transparent 28%),
          linear-gradient(180deg, #f6f3ed 0%, var(--bg) 100%);
        color: var(--text);
      }

      main {
        max-width: 860px;
        margin: 48px auto;
        padding: 0 20px;
      }

      article {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 32px;
        box-shadow: 0 18px 60px rgba(31, 41, 55, 0.08);
      }

      h1, h2 {
        line-height: 1.2;
      }

      h1 {
        margin-top: 0;
        font-size: 2.4rem;
      }

      h2 {
        margin-top: 28px;
        font-size: 1.2rem;
        color: var(--accent);
      }

      p {
        line-height: 1.75;
        color: var(--text);
      }

      .eyebrow {
        margin-bottom: 12px;
        font-size: 0.95rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      a {
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <main>
      <article>
        <div class="eyebrow">Kanban Discord Bot</div>
        <h1>${title}</h1>
        ${body}
      </article>
    </main>
  </body>
</html>`;
  }
}
