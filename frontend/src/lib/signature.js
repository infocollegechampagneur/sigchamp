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

function hexToRgb(h) {
  let x = String(h || "").replace("#", "").trim();
  if (x.length === 3) x = x.split("").map((c) => c + c).join("");
  if (x.length !== 6) return [37, 99, 235];
  const n = parseInt(x, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(rgb) {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}
function lighten(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const L = (v) => Math.round(v + (255 - v) * f);
  return `rgb(${L(r)},${L(g)},${L(b)})`;
}
// Accent color adapted for dark backgrounds (lightened when too dark to read).
export function darkAccentFor(primary) {
  return luminance(hexToRgb(primary)) < 0.55 ? lighten(primary, 0.6) : primary;
}
// Rules applied both for OS dark clients (@media) and the in-app preview (.sf-dark scope).
function darkStyleBlock(accent) {
  const r = `.sf-name{color:#f8fafc!important}.sf-text{color:#e5e7eb!important}.sf-text a{color:#e5e7eb!important}.sf-muted{color:#9ca3af!important}.sf-disc{color:#94a3b8!important}.sf-disc-line{border-top-color:#334155!important}.sf-accent{color:${accent}!important}.sf-social{color:#e5e7eb!important}.sf-bar{border-right-color:${accent}!important}.sf-bar-left{border-left-color:${accent}!important}`;
  const scoped = r.replace(/\.sf-/g, ".sf-dark .sf-");
  return `<style>@media (prefers-color-scheme:dark){${r}}${scoped}</style>`;
}

const SOCIAL_META = {
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
  twitter: { label: "X", color: "#111827" },
  facebook: { label: "Facebook", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E1306C" },
  youtube: { label: "YouTube", color: "#FF0000" },
  tiktok: { label: "TikTok", color: "#111827" },
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
  const logoW = Number(s.logo_width) || 86;
  const bannerW = Number(s.banner_width) || 600;
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
  const disclaimer = s.disclaimer || "";
  const bookingUrl = user.booking_url ? normUrl(user.booking_url) : "";
  const avatar = user.avatar_url || "";
  const companyLogo = s.logo_url || "";
  const leftImg = avatar || companyLogo;
  const logoInIdentity = !!(avatar && companyLogo);
  const topLogoW = Math.min(logoW + 30, 140);
  const avatarW = Number(user.avatar_width) || logoW;
  const leftW = avatar ? avatarW : logoW;
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
  const iconsMode = (s.social_style || "icons") === "icons";
  const socialSep = iconsMode ? "&nbsp;&nbsp;" : ' <span style="color:#d1d5db;">|</span> ';
  const socialLinks = Object.keys(SOCIAL_META)
    .filter((k) => social[k])
    .map((k) => {
      const meta = SOCIAL_META[k];
      const href = esc(normUrl(social[k]));
      if (iconsMode) {
        const icon = `${BACKEND}/api/social-icons/${k}.png`;
        return `<a href="${href}" style="text-decoration:none;display:inline-block;" target="_blank"><img src="${icon}" width="24" height="24" style="display:inline-block;border:0;width:24px;height:24px;vertical-align:middle;border-radius:5px;" alt="${meta.label}" /></a>`;
      }
      return `<a href="${href}" class="sf-social" style="color:${meta.color};text-decoration:none;font-weight:600;font-size:12px;" target="_blank">${meta.label}</a>`;
    });

  const contactLines = [];
  if (phoneStr)
    contactLines.push(`<tr><td class="sf-text" style="padding:1px 0;font-size:13px;color:${textColor};"><span class="sf-accent" style="color:${color};font-weight:700;">Tél&nbsp;</span>${phoneStr}</td></tr>`);
  if (direct)
    contactLines.push(`<tr><td class="sf-text" style="padding:1px 0;font-size:13px;color:${textColor};"><span class="sf-accent" style="color:${color};font-weight:700;">Ligne directe&nbsp;</span>${direct}</td></tr>`);
  if (email)
    contactLines.push(`<tr><td class="sf-text" style="padding:1px 0;font-size:13px;"><span class="sf-accent" style="color:${color};font-weight:700;">Courriel&nbsp;</span><a href="mailto:${email}" style="color:${textColor};text-decoration:none;">${email}</a></td></tr>`);
  if (website)
    contactLines.push(`<tr><td class="sf-text" style="padding:1px 0;font-size:13px;"><span class="sf-accent" style="color:${color};font-weight:700;">Web&nbsp;</span><a href="${esc(normUrl(website))}" style="color:${textColor};text-decoration:none;" target="_blank">${esc(website.replace(/^https?:\/\//i, ""))}</a></td></tr>`);
  if (address)
    contactLines.push(`<tr><td class="sf-muted" style="padding:1px 0;font-size:12px;color:${mutedColor};">${address}</td></tr>`);

  const logoCell = leftImg
    ? `<td class="sf-bar" style="vertical-align:top;padding-right:18px;border-right:3px solid ${color};">
         <img src="${esc(leftImg)}" width="${leftW}" style="display:block;width:${leftW}px;border-radius:6px;" alt="${company}" />
       </td>`
    : "";

  const logoRow = logoInIdentity
    ? `<tr><td style="padding-bottom:8px;"><img src="${esc(companyLogo)}" width="${topLogoW}" style="display:block;width:${topLogoW}px;max-width:100%;border-radius:4px;" alt="${company}" /></td></tr>`
    : "";

  const identityCell = `
    <td style="vertical-align:top;padding-left:${leftImg ? "18px" : "0"};">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        ${logoRow}
        <tr><td class="sf-name" style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0f172a;padding-bottom:2px;">${name}</td></tr>
        ${titleLine ? `<tr><td class="sf-accent" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:${color};padding-bottom:2px;">${titleLine}</td></tr>` : ""}
        ${company ? `<tr><td class="sf-name" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#0f172a;padding-bottom:6px;">${company}</td></tr>` : ""}
        ${contactLines.join("")}
        ${socialLinks.length ? `<tr><td style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;">${socialLinks.join(socialSep)}</td></tr>` : ""}
      </table>
    </td>`;

  if ((banner.layout || "classic") === "modern") {
    const parts = [];
    if (phoneStr) parts.push(`<span class="sf-accent" style="color:${color};font-weight:700;">Tél</span> ${phoneStr}`);
    if (direct) parts.push(`<span class="sf-accent" style="color:${color};font-weight:700;">Direct</span> ${direct}`);
    if (email) parts.push(`<a href="mailto:${email}" style="color:${textColor};text-decoration:none;">${email}</a>`);
    if (website) parts.push(`<a href="${esc(normUrl(website))}" style="color:${textColor};text-decoration:none;">${esc(website.replace(/^https?:\/\//i, ""))}</a>`);
    const contactInline = parts.join(' &nbsp;<span style="color:#d1d5db;">·</span>&nbsp; ');
    const photoCell = avatar
      ? `<td style="vertical-align:top;padding-right:16px;"><img src="${esc(avatar)}" width="${avatarW}" style="display:block;width:${avatarW}px;border-radius:6px;" alt="Photo" /></td>`
      : "";
    const contentLogo =
      (logoInIdentity ? `<img src="${esc(companyLogo)}" width="${topLogoW}" style="display:block;width:${topLogoW}px;max-width:100%;border-radius:4px;margin-bottom:8px;" alt="${company}" />` : "") +
      (!avatar && companyLogo ? `<img src="${esc(companyLogo)}" width="${logoW}" style="display:block;width:${logoW}px;border-radius:6px;margin-bottom:8px;" alt="${company}" />` : "");
    const modern =
      photoCell +
      `<td${avatar ? "" : ' colspan="2"'} class="sf-bar-left" style="border-left:4px solid ${color};padding:2px 0 2px 16px;">` +
      contentLogo +
      `<div class="sf-name" style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;color:#0f172a;">${name}</div>` +
      (titleLine ? `<div class="sf-accent" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:${color};padding-top:1px;">${titleLine}</div>` : "") +
      (company ? `<div class="sf-name" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#0f172a;padding-top:1px;">${company}</div>` : "") +
      (contactInline ? `<div class="sf-text" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#374151;padding-top:6px;">${contactInline}</div>` : "") +
      (address ? `<div class="sf-muted" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${mutedColor};padding-top:2px;">${address}</div>` : "") +
      (socialLinks.length ? `<div style="padding-top:6px;">${socialLinks.join(socialSep)}</div>` : "") +
      `</td>`;
    rows.push(`<tr>${modern}</tr>`);
  } else {
    rows.push(`<tr>${logoCell}${identityCell}</tr>`);
  }
  if (gifUrl) {
    const img = `<img src="${esc(gifUrl)}" width="${bannerW}" style="display:block;width:${bannerW}px;max-width:100%;border-radius:8px;border:0;" alt="Bannière" />`;
    let banner_html = img;
    if (bannerLink && user.id) {
      const track = `${BACKEND}/api/track/click?u=${encodeURIComponent(user.id)}&b=${encodeURIComponent(banner.key || "Défaut")}&url=${encodeURIComponent(bannerLink)}`;
      banner_html = `<a href="${esc(track)}" target="_blank" style="text-decoration:none;">${img}</a>`;
    } else if (bannerLink) {
      banner_html = `<a href="${esc(bannerLink)}" target="_blank" style="text-decoration:none;">${img}</a>`;
    }
    rows.push(`<tr><td colspan="2" style="padding-top:16px;">${banner_html}</td></tr>`);
  }

  // Booking CTA
  if (bookingUrl) {
    rows.push(`<tr><td colspan="2" style="padding-top:12px;"><a href="${esc(bookingUrl)}" target="_blank" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;padding:9px 16px;border-radius:6px;">Réservez une heure pour me rencontrer</a></td></tr>`);
  }

  // Disclaimer
  if (disclaimer) {
    rows.push(`<tr><td colspan="2" style="padding-top:14px;"><div class="sf-disc sf-disc-line" style="border-top:1px solid #e5e7eb;padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;color:#9ca3af;max-width:600px;">${disclaimer}</div></td></tr>`);
  }

  const styleBlock = darkStyleBlock(darkAccentFor(color));
  return `${styleBlock}<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">${rows.join("")}</table>`;
}

export const DEFAULT_DISCLAIMER =
  "Ce courriel et les documents qui y sont joints sont confidentiels et destinés exclusivement à la personne à laquelle ils sont adressés. Si vous n'êtes pas le destinataire visé, veuillez en aviser l'expéditeur immédiatement et supprimer ce courriel ainsi que toute copie.";
