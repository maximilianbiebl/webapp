/*
 * Dialoge, die zur Seite gehoeren.
 *
 * `alert` und `confirm` des Browsers sehen auf dem Telefon aus wie eine
 * Stoerung, nicht wie ein Teil der Anwendung. An der Stelle, an der jemand
 * einer Einladung zustimmen soll, ist das genau das falsche Gefuehl.
 */

function build(title, body, buttons) {
  const dialog = document.createElement("dialog");
  const heading = document.createElement("h2");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = body;
  dialog.append(heading, text);
  return { dialog, buttons };
}

function present(dialog, resolve, value) {
  document.body.append(dialog);
  dialog.addEventListener("close", () => {
    dialog.remove();
    resolve(value());
  });
  dialog.showModal();
}

/** Eine Frage mit zwei Antworten. Aufloesung: true, wenn zugestimmt wurde. */
export function ask(title, body, confirmLabel = "OK", cancelLabel = "Abbrechen") {
  return new Promise((resolve) => {
    const { dialog } = build(title, body);
    const actions = document.createElement("div");
    actions.className = "actions";

    const cancel = document.createElement("button");
    cancel.className = "ghost";
    cancel.textContent = cancelLabel;
    const confirm = document.createElement("button");
    confirm.textContent = confirmLabel;

    let agreed = false;
    cancel.addEventListener("click", () => dialog.close());
    confirm.addEventListener("click", () => {
      agreed = true;
      dialog.close();
    });

    actions.append(cancel, confirm);
    dialog.append(actions);
    present(dialog, resolve, () => agreed);
  });
}

/** Eine Mitteilung mit einem Weg heraus. */
export function say(title, body) {
  return new Promise((resolve) => {
    const { dialog } = build(title, body);
    const actions = document.createElement("div");
    actions.className = "actions";
    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.addEventListener("click", () => dialog.close());
    actions.append(ok);
    dialog.append(actions);
    present(dialog, resolve, () => undefined);
  });
}

/** Eine Zeile Text. Aufloesung: der Text, oder null bei Abbruch. */
export function askForText(title, label, confirmLabel = "OK") {
  return new Promise((resolve) => {
    const { dialog } = build(title, "");
    dialog.querySelector("p").remove();

    const field = document.createElement("input");
    field.type = "text";
    field.placeholder = label;
    field.autocomplete = "off";

    const actions = document.createElement("div");
    actions.className = "actions";
    const cancel = document.createElement("button");
    cancel.className = "ghost";
    cancel.textContent = "Abbrechen";
    const confirm = document.createElement("button");
    confirm.textContent = confirmLabel;

    let value = null;
    const accept = () => {
      if (!field.value.trim()) return;
      value = field.value.trim();
      dialog.close();
    };
    cancel.addEventListener("click", () => dialog.close());
    confirm.addEventListener("click", accept);
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") accept();
    });

    actions.append(cancel, confirm);
    dialog.append(field, actions);
    present(dialog, resolve, () => value);
    field.focus();
  });
}
