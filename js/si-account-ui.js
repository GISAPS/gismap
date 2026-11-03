// Account button and sign-in / sign-up dialog for GISMap SI. Shown only to
// invited testers (`/beta?code=...`) or users SI has given the `accounts` flag;
// everyone else sees no change and no request goes to SI. Opening the dialog
// never touches the map: the current map is kept as a recovery draft first.
import { betaInviteCode, createSiSession } from "./si-session.js?v=0.68.2-si-auth";

const SI_RESET_URL = "https://gismap.si/reset-password";
const SI_HOME_URL = "https://gismap.si/";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

// getDraftLink() returns a self-contained map link for the current map.
export function initSiAccountUi({ host = document.querySelector(".studio-header") || document.querySelector("#sidebar .brand"), getDraftLink = async () => location.href, location: loc = globalThis.location, session = createSiSession() } = {}) {
  const inviteCode = betaInviteCode(loc);
  if (!host) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "si-account-button";
  button.hidden = true;
  host.insertBefore(button, host.querySelector(":scope > :is(.studio-share, #sidebar-close)"));

  const menu = document.createElement("div");
  menu.className = "si-account-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  host.append(menu);

  const dialog = document.createElement("dialog");
  dialog.className = "app-dialog si-account-dialog";
  dialog.setAttribute("aria-labelledby", "si-account-title");
  document.body.append(dialog);

  let mode = "signin";

  function render(state = session.snapshot()) {
    const visible = Boolean(inviteCode) || state.flags.accounts;
    button.hidden = !visible;
    if (state.signedIn) {
      const name = state.user?.display_name || state.user?.name || state.user?.email || "Account";
      button.textContent = name.trim().charAt(0).toUpperCase() || "A";
      button.title = `Signed in to GISMap SI as ${name}`;
      button.setAttribute("aria-label", `Account menu for ${name}`);
      button.setAttribute("aria-haspopup", "menu");
      button.classList.add("is-signed-in");
    } else {
      button.textContent = "Sign in";
      button.title = "Sign in to GISMap SI";
      button.setAttribute("aria-label", "Sign in to GISMap SI");
      button.removeAttribute("aria-haspopup");
      button.classList.remove("is-signed-in");
      menu.hidden = true;
    }
    menu.innerHTML = state.signedIn ? `
      <p class="si-account-menu__who">${escapeHtml(state.user?.display_name || state.user?.name || "")}<small>${escapeHtml(state.user?.email || "")}</small></p>
      ${state.flags.save_maps ? '<button type="button" role="menuitem" data-si="my-maps" disabled title="Coming soon">My maps</button>' : ""}
      ${state.flags.save_datasets ? '<button type="button" role="menuitem" data-si="my-datasets" disabled title="Coming soon">My datasets</button>' : ""}
      <a role="menuitem" href="${SI_HOME_URL}" target="_blank" rel="noopener">Open GISMap SI</a>
      <button type="button" role="menuitem" data-si="sign-out">Sign out</button>` : "";
  }

  function renderDialog(message = "") {
    const signUp = mode === "signup";
    dialog.innerHTML = `
      <form class="dialog__shell si-account-form" novalidate>
        <header class="dialog__header">
          <div><span class="eyebrow">GISMap SI</span><h2 id="si-account-title">${signUp ? "Create your account" : "Sign in"}</h2></div>
          <div class="dialog__header-actions"><button class="icon-button" type="button" data-si="close" aria-label="Close">×</button></div>
        </header>
        <div class="dialog__content">
          <p class="si-account-form__note">Your map stays exactly as it is while you sign in.</p>
          ${signUp ? '<label>Name<input name="name" autocomplete="name" required /></label><label>Workspace name<input name="organizationName" autocomplete="organization" required minlength="2" maxlength="120" placeholder="Your team or organization" /></label>' : ""}
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="${signUp ? "new-password" : "current-password"}" required minlength="${signUp ? 12 : 1}" />${signUp ? '<small class="si-account-form__hint">At least 12 characters.</small>' : ""}</label>
          ${signUp ? '<label class="si-account-form__check"><input name="acceptTerms" type="checkbox" required /> I accept the <a href="https://gismap.si/terms" target="_blank" rel="noopener">terms</a> and <a href="https://gismap.si/privacy" target="_blank" rel="noopener">privacy policy</a></label>' : `<a class="si-account-form__link" href="${SI_RESET_URL}" target="_blank" rel="noopener">Forgot your password?</a>`}
          <p class="si-account-form__error" role="alert" ${message ? "" : "hidden"}>${escapeHtml(message)}</p>
        </div>
        <footer class="dialog__actions">
          <button type="button" class="button--quiet" data-si="switch">${signUp ? "I have an account" : "Create an account"}</button>
          <button type="submit" class="button--primary">${signUp ? "Create account" : "Sign in"}</button>
        </footer>
      </form>`;
  }

  async function open(nextMode = "signin") {
    mode = nextMode;
    try { session.saveRecoveryDraft({ link: await getDraftLink() }); } catch { /* the map is still in place */ }
    renderDialog();
    dialog.showModal();
    dialog.querySelector("input")?.focus();
  }

  function close() {
    dialog.close();
  }

  button.addEventListener("click", () => {
    if (session.snapshot().signedIn) {
      menu.hidden = !menu.hidden;
      if (!menu.hidden) menu.querySelector("[role=menuitem]:not([disabled])")?.focus();
    } else open();
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("[data-si=sign-out]")) session.signOut();
    menu.hidden = true;
  });
  document.addEventListener("click", (event) => { if (!menu.hidden && !menu.contains(event.target) && event.target !== button) menu.hidden = true; });

  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-si=close]")) close();
    if (event.target.closest("[data-si=switch]")) { mode = mode === "signup" ? "signin" : "signup"; renderDialog(); dialog.querySelector("input")?.focus(); }
  });
  dialog.addEventListener("close", () => session.takeRecoveryDraft());
  dialog.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    submit.textContent = mode === "signup" ? "Creating…" : "Signing in…";
    try {
      if (mode === "signup") await session.signUp({ name: values.name, organizationName: values.organizationName, email: values.email, password: values.password, acceptTerms: values.acceptTerms === "on", inviteCode });
      else await session.signIn({ email: values.email, password: values.password });
      close();
    } catch (error) {
      renderDialog(error?.message || "Sign-in didn't work. Try again.");
      const fields = dialog.querySelector("form").elements;
      for (const key of ["name", "organizationName", "email"]) if (fields[key] && values[key]) fields[key].value = values[key];
    }
  });

  // A reload while the dialog was open: offer the map back.
  const draft = session.takeRecoveryDraft();
  if (draft?.link && !loc.hash && draft.link !== loc.href) {
    const banner = document.createElement("div");
    banner.className = "si-account-recovery";
    banner.setAttribute("role", "status");
    banner.innerHTML = '<span>Your map from before sign-in was kept.</span><button type="button" data-si="restore">Restore it</button><button type="button" class="icon-button" data-si="dismiss" aria-label="Dismiss">×</button>';
    banner.addEventListener("click", (event) => {
      if (event.target.closest("[data-si=restore]")) loc.assign(draft.link);
      if (event.target.closest("[data-si]")) banner.remove();
    });
    document.body.append(banner);
  }

  session.subscribe(render);
  render();
  return { session, open, button, dialog };
}
