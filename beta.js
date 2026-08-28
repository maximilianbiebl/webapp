/*
 * Die Betaseite.
 *
 * Anmeldung ohne Umweg: Die Adresse geht direkt nach Firestore. Vorher hatte
 * ein mailto-Verweis das Mailprogramm geoeffnet und den Besucher die Nachricht
 * selbst schicken lassen - das ist zu umstaendlich fuer etwas, das ein
 * Formularfeld und ein Knopf sein sollte.
 */
import { firebase, isConfigured } from "./shared.js";
import { addDoc, collection, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { t, getLanguage, resolveLanguage, wireLanguagePicker } from "./strings.js";

/* --------------------------------------------------------------------------
 * HIER ABSCHALTEN, wenn die Testphase vorbei ist.
 *
 * `false` blendet Bilder, Formular und Links aus und zeigt stattdessen den
 * Hinweis, dass der Test beendet ist. Derselbe Schalter steht in index.html
 * und nimmt dort den Verweis von der Startseite.
 *
 * Danach koennen weg: die Regel fuer betaSignups in firestore.rules, die
 * Bilder unter beta/, diese Datei und beta.html.
 * -------------------------------------------------------------------------- */
const BETA_LAEUFT = true;

const OPT_IN = {
  free: "https://play.google.com/apps/testing/de.liegestuetzen.trainer.free",
  paid: "https://play.google.com/apps/testing/de.liegestuetzen.trainer",
};

function applyTranslations() {
  document.documentElement.lang = getLanguage() === "en" ? "en" : "de";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = t(el.dataset.i18n);
    // Mit data-i18n-attr gehoert die Uebersetzung in das Attribut, nicht in den
    // sichtbaren Inhalt - sonst verschwindet, was im Element steht.
    if (el.dataset.i18nAttr) {
      el.setAttribute(el.dataset.i18nAttr, text);
      return;
    }
    el.textContent = text;
  });
}

window.addEventListener("liegestuetzen:language", applyTranslations);
wireLanguagePicker(document.getElementById("langBtn"));
applyTranslations();

document.getElementById("betaLive").classList.toggle("hidden", !BETA_LAEUFT);
document.getElementById("betaOver").classList.toggle("hidden", BETA_LAEUFT);

/* ------------------------------------------------------------------ Bilder */

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");

document.querySelectorAll(".shot").forEach((knopf) => {
  knopf.addEventListener("click", () => {
    lightboxImg.src = knopf.dataset.full;
    lightbox.showModal();
  });
});
document.getElementById("lightboxClose").addEventListener("click", () => lightbox.close());
// Ein Klick neben das Bild schliesst ebenfalls - auf dem Handy trifft man den
// Rand leichter als den Knopf.
lightbox.addEventListener("click", (ereignis) => {
  if (ereignis.target === lightbox) lightbox.close();
});
// Das Bild erst beim Schliessen loslassen, damit der naechste Aufruf nicht
// kurz das vorige zeigt.
lightbox.addEventListener("close", () => { lightboxImg.removeAttribute("src"); });

/* -------------------------------------------------------------- Anmeldung */

const form = document.getElementById("betaForm");
const fehler = document.getElementById("betaError");
const knopf = document.getElementById("betaSubmit");

function zeigeFehler(schluessel) {
  fehler.textContent = t(schluessel);
  fehler.classList.remove("hidden");
}

form.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const adresse = document.getElementById("betaMail").value.trim();
  const free = document.getElementById("betaFree").checked;
  const paid = document.getElementById("betaPaid").checked;
  const einwilligung = document.getElementById("betaConsent").checked;

  // In der Reihenfolge der Felder auf dem Bildschirm - wer eine Meldung
  // bekommt, soll nicht suchen muessen, worauf sie sich bezieht.
  if (!free && !paid) return zeigeFehler("betaNeedVersion");
  // Absichtlich grob: Ob eine Adresse wirklich existiert, zeigt sich ohnehin
  // erst beim Freischalten. Die Pruefung faengt Tippfehler ab, mehr nicht.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) return zeigeFehler("betaNeedMail");
  if (adresse.length > 200) return zeigeFehler("betaNeedMail");
  if (!einwilligung) return zeigeFehler("betaNeedConsent");
  fehler.classList.add("hidden");

  if (!isConfigured) return zeigeFehler("betaFailed");

  knopf.disabled = true;
  const fassungen = [free && "free", paid && "paid"].filter(Boolean);
  try {
    const { db } = firebase();
    await addDoc(collection(db, "betaSignups"), {
      email: adresse.toLowerCase(),
      versions: fassungen,
      consent: true,
      // resolveLanguage statt getLanguage: Letzteres liefert "system", wenn
      // nichts eingestellt ist - als Angabe waere das wertlos.
      language: resolveLanguage(),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Was genau schiefging, hilft dem Besucher nicht weiter - er kann es nur
    // noch einmal versuchen oder schreiben.
    knopf.disabled = false;
    return zeigeFehler("betaFailed");
  }

  document.getElementById("betaLinkFree").href = OPT_IN.free;
  document.getElementById("betaLinkPaid").href = OPT_IN.paid;
  document.getElementById("betaLinkFree").classList.toggle("hidden", !free);
  document.getElementById("betaLinkPaid").classList.toggle("hidden", !paid);
  form.classList.add("hidden");
  const fertig = document.getElementById("betaDone");
  fertig.classList.remove("hidden");
  fertig.scrollIntoView({ behavior: "smooth", block: "start" });
});
