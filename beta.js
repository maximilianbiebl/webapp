/*
 * Die Betaseite.
 *
 * Anmeldung in einem Schritt: Das Formular hier schickt seine Angaben an ein
 * Google-Formular, dessen Antworten in einer Tabelle landen. Die Seite behaelt
 * damit ihr eigenes Aussehen, und es braucht weder einen Server noch einen
 * Schreibzugang auf die Datenbank der App - Anmeldungen von Fremden haben
 * dort nichts zu suchen.
 */
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

/* --------------------------------------------------------------------------
 * EINMAL EINTRAGEN: das Google-Formular, das die Anmeldungen sammelt.
 *
 * So kommst du an die Werte:
 *   1. Auf forms.google.com ein Formular mit drei kurzen Antwortfeldern
 *      anlegen - Adresse, Fassung, Sprache.
 *   2. Im Dreipunktmenue "Link zum Ausfuellen abrufen" waehlen, in jedes Feld
 *      irgendetwas eintragen und den Link erzeugen lassen.
 *   3. Der Link sieht so aus:
 *        .../forms/d/e/1FAIpQLSd.../viewform?entry.123=a&entry.456=b&...
 *      Zwischen /d/e/ und /viewform steht FORMULAR_ID; die Zahlen hinter
 *      "entry." gehoeren in FELD, in der Reihenfolge der Fragen.
 *   4. Im Formular unter "Antworten" eine Tabelle verknuepfen. Dort stehen die
 *      Adressen, und von dort laesst sich alles als CSV herunterladen.
 *
 * Solange hier die Platzhalter stehen, nimmt die Seite keine Anmeldung an und
 * sagt das auch - lieber eine ehrliche Fehlermeldung als ein Knopf, der zu
 * funktionieren scheint und ins Leere schickt.
 * -------------------------------------------------------------------------- */
const FORMULAR_ID = "HIER_FORMULAR_ID_EINTRAGEN";
const FELD = {
  adresse: "entry.000000001",
  fassung: "entry.000000002",
  sprache: "entry.000000003",
};

const FORMULAR_BEREIT =
  !FORMULAR_ID.startsWith("HIER_") &&
  !Object.values(FELD).some((feld) => feld.includes("00000000"));

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

  if (!FORMULAR_BEREIT) {
    // Sichtbar fuer den Besucher, nachvollziehbar fuer den Betreiber.
    console.error(
      "Betaanmeldung: FORMULAR_ID und FELD in beta.js sind noch Platzhalter.",
    );
    return zeigeFehler("betaFailed");
  }

  knopf.disabled = true;
  const felder = new URLSearchParams();
  felder.set(FELD.adresse, adresse.toLowerCase());
  felder.set(FELD.fassung, [free && "free", paid && "paid"].filter(Boolean).join(" + "));
  // resolveLanguage statt getLanguage: Letzteres liefert "system", wenn nichts
  // eingestellt ist - als Angabe waere das wertlos.
  felder.set(FELD.sprache, resolveLanguage());

  try {
    /*
     * `no-cors`, weil Google-Formulare keine CORS-Kopfzeilen mitschicken.
     * Der Preis: Die Antwort ist nicht lesbar, ein abgelehnter Eintrag also
     * nicht von einem angenommenen zu unterscheiden. Nur ein Netzfehler
     * schlaegt hier auf. Deshalb steht unten der Hinweis, sich zu melden,
     * falls nach ein paar Tagen nichts kommt.
     */
    await fetch(
      `https://docs.google.com/forms/d/e/${FORMULAR_ID}/formResponse`,
      { method: "POST", mode: "no-cors", body: felder },
    );
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
