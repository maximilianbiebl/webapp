/*
 * Die Zugangsdaten des Web-Clients.
 *
 * Das sind KEINE Geheimnisse – sie stehen in jeder Firebase-Web-App offen im
 * Quelltext des Browsers, und das ist so vorgesehen. Was jemand mit ihnen tun
 * darf, entscheiden allein die Security Rules. Der Schlüssel identifiziert das
 * Projekt, er berechtigt zu nichts.
 *
 * Sinnvoll ist trotzdem, ihn in der Google-Cloud-Konsole auf die eigene Domain
 * zu beschränken (APIs & Dienste -> Anmeldedaten -> Anwendungseinschränkungen
 * -> HTTP-Verweis-URLs). Das schützt keine Daten, hält aber fremde Seiten davon
 * ab, das Kontingent des Projekts zu verbrauchen.
 *
 * Neue Werte holt man sich in der Firebase-Konsole unter
 * Projekteinstellungen -> Meine Apps -> Web-App.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCJazNo4iJmfE0oMHyvx6OZ-8X7e5IflTk",
  authDomain: "liegestutzen.firebaseapp.com",
  projectId: "liegestutzen",
  storageBucket: "liegestutzen.firebasestorage.app",
  messagingSenderId: "54639713196",
  appId: "1:54639713196:web:fadaefe12ac297e954b809",
};

/**
 * Fehlt etwas, sagt die Seite das, statt still zu scheitern. Ein leeres
 * Anmeldefenster ohne Erklärung ist die schlechteste aller Fehlermeldungen.
 */
export const isConfigured = Object.values(firebaseConfig).every(
  (value) => value && !value.includes("HIER_EINSETZEN"),
);
