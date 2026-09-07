// Builds Outlook-compatible, table-based inline-CSS email signature HTML.

const BACKEND = process.env.REACT_APP_BACKEND_URL;

function esc(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function normUrl(u) {
  if (!u) return "";
  const t = String(u).trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

const SOCIAL_META = {
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
  twitter: { label: "X", color: "#111827" },
  facebook: { label: "Facebook", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E1306C" },
  youtube: { label: "YouTube", color: "#FF0000" },
};

export function resolveBanner(user = {}, s = {}) {
  const dept = (user.department || "").trim().toLowerCase();
  const list = s.department_banners || [];
  const defLayout = s.signature_layout || "classic";
  const match = list.find((b) => (b.name || "").trim().toLowerCase() === dept);
  if (match) return { gif_url: match.gif_url || s.gif_url || "", banner_link: match.banner_link || s.banner_link || "", key: match.name, layout: match.layout || defLayout };
  return { gif_url: s.gif_url || "", banner_link: s.banner_link || "", key: "Défaut", layout: defLayout };
}

export function buildSignatureHtml(user = {}, s = {}) {
  const color = s.primary_color || "#2563EB";
  const textColor = "#1f2937";
  const mutedColor = "#6b7280";

  const name = esc(user.name || "Nom Prénom");
  const title = esc(user.title || "");
  const dept = esc(user.department || "");
  const email = esc(user.email || "");
  const ext = esc(user.phone_ext || "");
  const direct = esc(user.direct_line || "");
  const phoneMain = esc(s.phone_main || "");
  const company = esc(s.company_name || "");
  const website = s.website || "";
  const address = esc(s.address || "");
  const disclaimer = esc(s.disclaimer || "");
  const logo = user.avatar_url || s.logo_url || "";
  const banner = resolveBanner(user, s);
  const gifUrl = banner.gif_url || "";
  const bannerLink = normUrl(banner.banner_link);

  const titleLine = [title, dept].filter(Boolean).join(" · ");

  // Phone display
  const phoneParts = [];
  if (phoneMain) phoneParts.push(phoneMain);
  if (ext) phoneParts.push(`poste ${ext}`);
  const phoneStr = phoneParts.join(" ");

  const rows = [];

  // Social links row
  const social = s.social || {};
  const socialLinks = Object.keys(SOCIAL_META)
    .filter((k) => social[k])
    .map((k) => {
      const meta = SOCIAL_META[k];
      return `<a href="${esc(normUrl(social[k]))}" style="color:${meta.color};text-decoration:none;font-weight:600;font-size:12px;" target="_blank">${meta.label}</a>`;
    });

  const contactLines = [];
  if (phoneStr)
    contactLines.push(`<tr><td style="padding:1px 0;font-size:13px;color:${textColor};"><span style="color:${color};font-weight:700;">Tél&nbsp;</span>${phoneStr}</td></tr>`);
  if (direct)
    contactLines.push(`<tr><td style="padding:1px 0;font-size:13px;color:${textColor};"><span style="color:${color};font-weight:700;">Ligne directe&nbsp;</span>${direct}</td></tr>`);
  if (email)
    contactLines.push(`<tr><td style="padding:1px 0;font-size:13px;"><span style="color:${color};font-weight:700;">Courriel&nbsp;</span><a href="mailto:${email}" style="color:${textColor};text-decoration:none;">${email}</a></td></tr>`);
  if (website)
    contactLines.push(`<tr><td style="padding:1px 0;font-size:13px;"><span style="color:${color};font-weight:700;">Web&nbsp;</span><a href="${esc(normUrl(website))}" style="color:${textColor};text-decoration:none;" target="_blank">${esc(website.replace(/^https?:\/\//i, ""))}</a></td></tr>`);
  if (address)
    contactLines.push(`<tr><td style="padding:1px 0;font-size:12px;color:${mutedColor};">${address}</td></tr>`);

  const logoCell = logo
    ? `<td style="vertical-align:top;padding-right:18px;border-right:3px solid ${color};">
         <img src="${esc(logo)}" width="86" style="display:block;width:86px;border-radius:6px;" alt="${company}" />
       </td>`
    : "";

  const identityCell = `
    <td style="vertical-align:top;padding-left:${logo ? "18px" : "0"};">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0f172a;padding-bottom:2px;">${name}</td></tr>
        ${titleLine ? `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:${color};padding-bottom:2px;">${titleLine}</td></tr>` : ""}
        ${company ? `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#0f172a;padding-bottom:6px;">${company}</td></tr>` : ""}
        ${contactLines.join("")}
        ${socialLinks.length ? `<tr><td style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;">${socialLinks.join(' <span style="color:#d1d5db;">|</span> ')}</td></tr>` : ""}
      </table>
    </td>`;

  if ((banner.layout || "classic") === "modern") {
    const parts = [];
    if (phoneStr) parts.push(`<span style="color:${color};font-weight:700;">Tél</span> ${phoneStr}`);
    if (direct) parts.push(`<span style="color:${color};font-weight:700;">Direct</span> ${direct}`);
    if (email) parts.push(`<a href="mailto:${email}" style="color:${textColor};text-decoration:none;">${email}</a>`);
    if (website) parts.push(`<a href="${esc(normUrl(website))}" style="color:${textColor};text-decoration:none;">${esc(website.replace(/^https?:\/\//i, ""))}</a>`);
    const contactInline = parts.join(' &nbsp;<span style="color:#d1d5db;">·</span>&nbsp; ');
    const logoHtml = logo ? `<img src="${esc(logo)}" width="52" style="display:block;width:52px;border-radius:6px;margin-bottom:8px;" alt="${company}" />` : "";
    const modern =
      `<td colspan="2" style="border-left:4px solid ${color};padding:2px 0 2px 16px;">` +
      logoHtml +
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;color:#0f172a;">${name}</div>` +
      (titleLine ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:${color};padding-top:1px;">${titleLine}</div>` : "") +
      (company ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#0f172a;padding-top:1px;">${company}</div>` : "") +
      (contactInline ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#374151;padding-top:6px;">${contactInline}</div>` : "") +
      (address ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${mutedColor};padding-top:2px;">${address}</div>` : "") +
      (socialLinks.length ? `<div style="padding-top:6px;">${socialLinks.join(' <span style="color:#d1d5db;">|</span> ')}</div>` : "") +
      `</td>`;
    rows.push(`<tr>${modern}</tr>`);
  } else {
    rows.push(`<tr>${logoCell}${identityCell}</tr>`);
  }
  if (gifUrl) {
    const img = `<img src="${esc(gifUrl)}" width="600" style="display:block;width:600px;max-width:100%;border-radius:8px;border:0;" alt="Bannière" />`;
    let banner_html = img;
    if (bannerLink && user.id) {
      const track = `${BACKEND}/api/track/click?u=${encodeURIComponent(user.id)}&b=${encodeURIComponent(banner.key || "Défaut")}&url=${encodeURIComponent(bannerLink)}`;
      banner_html = `<a href="${esc(track)}" target="_blank" style="text-decoration:none;">${img}</a>`;
    } else if (bannerLink) {
      banner_html = `<a href="${esc(bannerLink)}" target="_blank" style="text-decoration:none;">${img}</a>`;
    }
    rows.push(`<tr><td colspan="2" style="padding-top:16px;">${banner_html}</td></tr>`);
  }

  // Disclaimer
  if (disclaimer) {
    rows.push(`<tr><td colspan="2" style="padding-top:14px;"><div style="border-top:1px solid #e5e7eb;padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;color:#9ca3af;max-width:600px;">${disclaimer}</div></td></tr>`);
  }

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">${rows.join("")}</table>`;
}

export const DEFAULT_DISCLAIMER =
  "Ce courriel et les documents qui y sont joints sont confidentiels et destinés exclusivement à la personne à laquelle ils sont adressés. Si vous n'êtes pas le destinataire visé, veuillez en aviser l'expéditeur immédiatement et supprimer ce courriel ainsi que toute copie.";
