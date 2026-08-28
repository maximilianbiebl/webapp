/*
 * Uebersetzungen der Webseite.
 *
 * Dieselbe Idee wie values/strings.xml und values-en/strings.xml in der App:
 * Deutsch als Grundlage, Englisch daneben, und eine Einstellung, die die
 * Systemsprache uebersteuern kann. Anders als in der App braucht es hier
 * keinen Ressourcen-Mechanismus - ein Objekt pro Sprache und eine Funktion,
 * die nachschlaegt, reichen fuer eine Seite ohne Bauschritt.
 *
 * Werte sind entweder ein fertiger Text oder eine Funktion, die aus
 * Platzhaltern einen Text baut - genau die Faelle, in denen ein XML-Format
 * wie %1$d gebraucht wuerde.
 */

const STORAGE_KEY = "liegestuetzen.language";

/** Die drei Sprachoptionen, an einer Stelle - jede Seite baut ihre Chips daraus. */
export const LANGUAGE_OPTIONS = [
  ["system", "languageSystem"],
  ["de", "languageDe"],
  ["en", "languageEn"],
];

const STRINGS = {
  de: {
    // Start- und Anmeldeseite
    brand: "Liegestütze",
    betaTitle: "Zum Betatest anmelden",
    betaTeaserTitle: "Am Betatest teilnehmen",
    betaTeaserBody:
      "Die App steht noch nicht öffentlich im Play-Store \u2013 der Zugang läuft " +
      "über eine Testerliste. Auf der Betaseite siehst du, was dich erwartet, " +
      "und meldest dich in einem Schritt an.",
    betaTeaserButton: "Zum Betatest",
    betaFormTitle: "Anmeldung",
    betaTapHint: "Zum Vergrößern antippen.",
    betaCloseImage: "Schließen",
    betaDoneTitle: "Angemeldet",
    betaDoneContact:
      "Sollte sich nach ein paar Tagen nichts tun, schreib mir kurz \u2013 die " +
      "Adresse steht im Impressum.",
    betaFailed: "Das hat gerade nicht geklappt. Versuch es später noch einmal.",
    betaOverTitle: "Der Betatest ist beendet",
    betaOverBody:
      "Danke an alle, die mitgemacht haben. Die Apps sind jetzt regulär im " +
      "Play-Store zu finden.",
    betaIntro:
      "Beide Fassungen laufen gerade in einer geschlossenen Testphase. Der " +
      "Play-Store zeigt sie nur, wenn deine Adresse vorher freigeschaltet ist \u2013 " +
      "deshalb siehst du hier, worum es geht.",
    betaFreeTitle: "Liegestütze Free",
    betaFreeBody:
      "Der ganze Trainingsplan über 40 Level, Verlauf und Widgets. Ohne Konto, " +
      "ohne Internet \u2013 nichts verlässt dein Gerät.",
    betaPaidTitle: "Liegestütze",
    betaPaidBody:
      "Alles aus der Gratisfassung, dazu Konto, Gruppen und Freunde \u2013 mit " +
      "gemeinsamer Bestenliste und Direktvergleich. Im Betatest kostenlos.",
    betaWhich: "Wofür möchtest du dich anmelden?",
    betaFreeLabel: "Liegestütze Free",
    betaPaidLabel: "Liegestütze mit Gruppen und Freunden – im Test kostenlos",
    betaMailLabel: "Deine Google-Adresse",
    betaMailPlaceholder: "name@gmail.com",
    betaMailHint:
      "Es muss die Adresse sein, mit der du im Play-Store angemeldet bist \u2013 " +
      "eine andere kann Google nicht freischalten.",
    betaConsentText:
      "Ich bin damit einverstanden, dass meine Adresse gespeichert, zur " +
      "Freischaltung des Betatests verwendet und dafür in die Testerliste der " +
      "Google Play Console eingetragen wird. Widerruf jederzeit formlos möglich.",
    betaConsentLink: "Mehr dazu",
    betaNeedConsent: "Ohne diese Einwilligung kann ich dich nicht freischalten.",
    betaSubmit: "Anmeldung schreiben",
    betaNeedMail: "Bitte trag eine gültige Adresse ein.",
    betaNeedVersion: "Wähl mindestens eine Fassung aus.",
    betaDoneBody:
      "Danke! Sobald deine Adresse freigeschaltet ist, führen diese Links zum " +
      "Testzugang. Vorher zeigt Google dort nur eine Fehlermeldung \u2013 das ist " +
      "normal und heißt nicht, dass etwas schiefgegangen ist.",
    betaLinkFree: "Testzugang: Liegestütze Free",
    betaLinkPaid: "Testzugang: Liegestütze",
    homeHeading: "Vom ersten Satz bis zu hundert am Stück",
    homeLead: "Ein Trainingsplan über 40 Level – auf dem Handy oder im Browser.",
    homeMobileTitle: "Auf dem Handy",
    homeMobileBody:
      "Die App läuft ab Android 7. Trainieren geht vollständig ohne Konto – dann " +
      "verlässt kein einziges Byte dein Gerät.",
    homeMobileButton: "Android-App herunterladen",
    homeBrowserTitle: "Im Browser",
    homeBrowserBody:
      "Trainieren, Level wechseln, Verlauf – auch ganz ohne Konto. Meldest du " +
      "dich mit demselben Google-Konto an wie auf dem Handy, siehst du dort " +
      "dieselben Gruppen und Freunde.",
    homeBrowserButton: "Web-Version öffnen",
    languageLabel: "Sprache",
    languageSystem: "System",
    languageDe: "Deutsch",
    languageEn: "Englisch",

    unconfiguredTitle: "Noch nicht eingerichtet",
    unconfiguredBody:
      "In web/firebase-config.js fehlen die Zugangsdaten der Web-App. Sie " +
      "stehen in der Firebase-Konsole unter Projekteinstellungen → Meine " +
      "Apps → Web-App hinzufügen.",
    authChecking: "Wird geprüft …",

    signInTitle: "Anmelden",
    signInBodyAccount:
      "Nimm dasselbe Google-Konto wie in der App – dann siehst du hier " +
      "dieselben Gruppen und Freunde. Verknüpfe dein Konto vorher in der App " +
      "unter Einstellungen → Konto, sonst legst du hier ein zweites an.",
    signInBodyGuest:
      "Oder trainiere ohne Konto: Level, Verlauf und Satzpause funktionieren " +
      "dann direkt in diesem Browser. Nur Gruppen und Freunde brauchen später " +
      "eine Anmeldung.",
    signInGoogle: "Mit Google anmelden",
    signInGuest: "Als Gast fortfahren",
    signInBackHome: "Zur Startseite",
    signInInviteHint: "Du hast eine Einladung dabei. Melde dich an, dann wird sie gleich eingelöst.",
    signInFailed: (reason) => `Anmeldung fehlgeschlagen: ${reason}`,
    signInPopupBlocked:
      "Der Browser hat das Anmeldefenster blockiert. Erlaube Pop-ups für diese Seite und versuch es noch einmal.",

    // Reiter und obere Leiste
    tabTraining: "Training",
    tabFriends: "Freunde",
    tabGroups: "Gruppen",
    tabHistory: "Verlauf",
    backBtn: "Zurück",
    settingsBtn: "Einstellungen",

    // Training-Reiter
    yourLevel: "Dein Level",
    levelOf: (n, total) => `Level ${n} von ${total}`,
    levelSummary: (total, sets, rest) =>
      `${total} Wiederholungen in ${sets} Sätzen, ${rest} s Pause dazwischen.`,
    levelHint: (result, suggested) =>
      `Dein Test von ${result} am Stück spricht für Level ${suggested}.`,
    startWorkout: "Training starten",
    allLevelsBtn: "Alle Level ansehen",
    allLevelsTitle: "Alle Level",
    allLevelsHint: "Tippe auf ein Level, um dorthin zu wechseln.",
    allLevelsClose: "Schließen",
    yourLevelSuffix: " · dein Level",
    yourNumbers: "Deine Zahlen",
    statReps: "Wiederholungen",
    statWorkouts: "Einheiten",
    statStreak: "Tage in Folge",
    goalLine: (best, goal, percent) => `Ziel: ${best} von ${goal} am Stück (${percent} %) — ändern`,
    goalPrompt: "Dein Ziel",
    goalPromptLabel: "Liegestütze am Stück",
    goalPromptSave: "Speichern",
    testLineDone: (n) => `Letzter Maximaltest: ${n} am Stück`,
    testLineNone: "Noch kein Maximaltest gemacht — der geht in der App.",
    toHistory: "Ganzen Verlauf ansehen",
    saveFailedTitle: "Nicht gespeichert",

    // Freunde und Gruppen
    connectFirstTitle: "Erst das Konto verbinden",
    connectFirstBody:
      "Freunde und Gruppen brauchen ein Konto. Solange du keines verbindest, " +
      "bleibt dein Training vollständig auf diesem Gerät.",
    connectFirstAction: "Anmelden",
    friendsTitle: "Freunde",
    redeemBtn: "Einladung einlösen",
    loading: "Wird geladen …",
    inviteFriendBtn: "Freund einladen",
    friendsIncomingHint: "Offene Anfragen an dich – annehmen geht in der App:",
    friendsWaiting: "wartet",
    friendsEmpty: "Noch keine Freunde.",
    friendsCompare: "Vergleichen",
    friendsUnnamed: "Ohne Namen",
    groupsTitle: "Gruppen",
    joinGroupBtn: "Beitreten",
    newGroupBtn: "Neue Gruppe",
    groupsEmpty: "Noch in keiner Gruppe.",
    groupsSharingPaused: "Teilen pausiert",
    groupsView: "Ansehen",
    groupsUnnamed: "Gruppe ohne Namen",
    historyTitle: "Verlauf",

    // Konto- und Einstellungen-Dialog
    settingsTitle: "Einstellungen",
    settingsAccountEmail: (email) => email || "Anonymes Konto",
    settingsNamePlaceholder: "Anzeigename",
    settingsRestTitle: "Satzpause",
    settingsRestAdd: "+30 s",
    settingsGuestHint: "Ohne Konto bleibt dein Training auf diesem Gerät.",
    settingsGuestConnect: "Für Freunde und Gruppen brauchst du ein Konto.",
    settingsSignInBtn: "Anmelden",
    settingsClose: "Schließen",
    settingsSave: "Speichern",
    settingsSignOut: "Abmelden",
    signOutTitle: "Abmelden",
    signOutBody:
      "Du meldest dich von diesem Browser ab. Dein Training auf deinem " +
      "Telefon bleibt erhalten. Mit demselben Google-Konto kommst du " +
      "jederzeit zurück.",
    signOutConfirm: "Abmelden",
    cancel: "Abbrechen",

    // Verlauf
    statBestSet: "Bester Satz",
    statBestSession: "Beste Einheit",
    statLast7: "Letzte 7 Tage",
    historyEmpty: "Noch kein Training aufgezeichnet.",
    historyReps: (n, level) => `${n} Wiederholungen · Level ${level}`,
    deleteBtn: "Löschen",
    deleteTitle: "Einheit löschen",
    deleteBody: "Sie verschwindet auch aus jeder Gruppe und jedem Vergleich, in dem sie stand.",
    deleteFailedTitle: "Nicht gelöscht",

    // Gruppen-/Freundes-Detail
    noAccess: (reason) => `Kein Zugriff: ${reason}`,
    rangeLabel: "Zeitraum",
    range7: "7 Tage",
    range30: "30 Tage",
    rangeAll: "Gesamt",
    sortLabel: "Sortierung",
    sortReps: "Wdh.",
    sortBest: "Bester",
    sortDays: "Tage",
    groupColName: "Name",
    groupColReps: "Wdh.",
    groupColBest: "Bester",
    groupColDays: "Tage",
    groupTotal: (total, average) => `Gruppe gesamt ${total} · Durchschnitt ${average}`,
    groupIdLabel: "Gruppen-ID:",
    groupManageHint: "Verwalten, umbenennen und verlassen geht in der App.",
    friendGone: "Diese Freundschaft besteht nicht mehr.",
    friendGoneTitle: "Nicht mehr verbunden",
    comparePausedHint: "Diese Person teilt ihre Zahlen mit dir gerade nicht.",
    friendManageHint: "Entfernen, blockieren und Teilen pausieren geht in der App.",
    compareRepsLabel: "Wiederholungen",
    compareBestLabel: "Bester Satz",
    compareDaysLabel: "Trainingstage",
    compareLevelLabel: "Level",
    compareNeverTrained: "noch nie",
    compareLastTrained: "zuletzt trainiert",

    // Gruppen/Freunde-Aktionen
    newGroupTitle: "Neue Gruppe",
    newGroupLabel: "Name der Gruppe",
    createBtn: "Anlegen",
    createFailedTitle: "Anlegen fehlgeschlagen",
    joinGroupTitle: "Gruppe beitreten",
    joinGroupLabel: "Gruppen-ID oder Link",
    nextBtn: "Weiter",
    invalidTitle: "Ungültig",
    invalidCode: "Das sieht nicht nach einer Gruppen-ID aus.",
    invalidInviteCode: "Das sieht nicht nach einem Einladungscode aus.",
    notFoundTitle: "Nicht gefunden",
    groupNotFound: "Zu diesem Code gibt es keine Gruppe.",
    joinGroupQuestion: (name) => `„${name}“ beitreten? Deine Trainingszahlen erscheinen dann in der Bestenliste dieser Gruppe.`,
    joinBtn: "Beitreten",
    joinFailedTitle: "Beitreten fehlgeschlagen",
    inviteCreated: (link) => `Der Link ist in der Zwischenablage und sieben Tage gültig: ${link}`,
    inviteCreatedTitle: "Einladung erstellt",
    redeemTitle: "Einladung einlösen",
    redeemLabel: "Code oder Link",
    inviteNotFound: "Zu diesem Code gibt es keine Einladung.",
    inviteOwn: "Diesen Code hast du selbst ausgestellt.",
    inviteOwnTitle: "Deine eigene Einladung",
    inviteExpired: "Diese Einladung ist abgelaufen oder wurde schon eingelöst. Lass dir eine neue schicken.",
    inviteExpiredTitle: "Nicht mehr gültig",
    inviteFrom: (name) => `Einladung von ${name}`,
    inviteFromQuestion: (name) => `Mit ${name} verbinden? Ihr seht dann gegenseitig eure Trainingszahlen.`,
    connectBtn: "Verbinden",
    redeemFailedTitle: "Einlösen fehlgeschlagen",
    codeNotFound: "Zu diesem Code gibt es weder eine Gruppe noch eine Einladung. Vielleicht ein Tippfehler, oder die Einladung wurde zurückgezogen.",
    codeNothingFound: "Nichts gefunden",
    codeCheckFailed: (reason) => `Der Code ließ sich nicht prüfen: ${reason}`,
    codeCheckFailedTitle: "Das ging schief",
    anonymousName: "Anonym",
    someoneName: "Jemand",
    ok: "OK",

    // Training
    workoutLevel: (n) => `Level ${n}`,
    workoutPrepareNote: (n) => `Erster Satz: ${n} Wiederholungen`,
    workoutPrepareSet: "Gleich geht es los",
    workoutPrepareUnit: "Sekunden",
    workoutStartNow: "Jetzt starten",
    workoutRest: "Pause",
    workoutGetReady: "Fertig machen …",
    workoutRestUnit: "Sekunden Pause",
    workoutNextSet: (nr, reps) => `Danach: Satz ${nr} mit ${reps} Wiederholungen`,
    workoutSkipRest: "Weiter",
    workoutSetOf: (n, total) => `Satz ${n} von ${total}`,
    workoutTargetOf: (n) => `Ziel: ${n}`,
    workoutTapHint: "Tippen, um zu zählen",
    workoutThenAlso: (rest) => `Danach noch: ${rest}`,
    workoutLastSet: "Letzter Satz",
    workoutFinishSet: "Satz beenden",
    workoutAbort: "Abbrechen",
    workoutStop: "Hier beenden",
    workoutMinus: "−1",
    workoutPlus: "+1",
    workoutAbortTitle: "Training beenden?",
    workoutAbortBody: "Du kannst die bisherigen Sätze speichern, oder das Training komplett verwerfen.",
    workoutAbortSave: "Beenden und speichern",
    workoutAbortDiscard: "Verwerfen",
    workoutDoneTitle: "Training geschafft",
    workoutEndedTitle: "Training beendet",
    workoutSummary: (done, sets, list, target, best) =>
      `${done} Wiederholungen in ${sets} Sätzen (${list}), geplant waren ${target}. Bester Satz: ${best}.`,
    workoutUploadFailedTitle: "Nicht überall gespeichert",
    workoutUploadFailed: (reason) =>
      `Dein Training ist gezählt, konnte aber nicht vollständig hochgeladen werden: ${reason}`,
  },

  en: {
    brand: "Push-Ups",
    betaTitle: "Join the beta test",
    betaTeaserTitle: "Join the beta test",
    betaTeaserBody:
      "The app is not public in the Play Store yet \u2013 access runs through a " +
      "tester list. The beta page shows what to expect and lets you sign up in " +
      "one step.",
    betaTeaserButton: "To the beta test",
    betaFormTitle: "Sign up",
    betaTapHint: "Tap to enlarge.",
    betaCloseImage: "Close",
    betaDoneTitle: "You are signed up",
    betaDoneContact:
      "If nothing happens within a few days, drop me a line \u2013 the address is " +
      "in the imprint.",
    betaFailed: "That did not work just now. Please try again later.",
    betaOverTitle: "The beta test has ended",
    betaOverBody:
      "Thank you to everyone who took part. Both apps are now in the Play " +
      "Store for everyone.",
    betaIntro:
      "Both versions are in a closed test right now. The Play Store only shows " +
      "them once your address has been added \u2013 so here is what you would be " +
      "signing up for.",
    betaFreeTitle: "Push-Ups Free",
    betaFreeBody:
      "The full 40-level training plan, history and widgets. No account, no " +
      "internet \u2013 nothing leaves your device.",
    betaPaidTitle: "Push-Ups",
    betaPaidBody:
      "Everything from the free version, plus an account, groups and friends \u2013 " +
      "with a shared leaderboard and head-to-head comparison. Free during the " +
      "beta test.",
    betaWhich: "Which one would you like?",
    betaFreeLabel: "Push-Ups Free",
    betaPaidLabel: "Push-Ups with groups and friends – free during the test",
    betaMailLabel: "Your Google address",
    betaMailPlaceholder: "name@gmail.com",
    betaMailHint:
      "It has to be the address you use in the Play Store \u2013 Google cannot " +
      "grant access to any other one.",
    betaConsentText:
      "I agree that my address may be stored, used to grant access to the beta " +
      "test and added to the tester list in the Google Play Console for that " +
      "purpose. I can withdraw this at any time, informally.",
    betaConsentLink: "More on this",
    betaNeedConsent: "Without this consent I cannot grant you access.",
    betaSubmit: "Write the request",
    betaNeedMail: "Please enter a valid address.",
    betaNeedVersion: "Pick at least one version.",
    betaDoneBody:
      "Thank you. Once your address has been added, these links lead to the " +
      "test. Before that Google only shows an error there \u2013 that is normal " +
      "and does not mean anything went wrong.",
    betaLinkFree: "Test access: Push-Ups Free",
    betaLinkPaid: "Test access: Push-Ups",
    homeHeading: "From your first set to a hundred in a row",
    homeLead: "A 40-level training plan – on your phone or in the browser.",
    homeMobileTitle: "On your phone",
    homeMobileBody:
      "The app runs on Android 7 and up. Training works entirely without an " +
      "account – then not a single byte leaves your device.",
    homeMobileButton: "Download the Android app",
    homeBrowserTitle: "In the browser",
    homeBrowserBody:
      "Train, change level, view history – all without an account too. Sign " +
      "in with the same Google account as on your phone to see the same " +
      "groups and friends there.",
    homeBrowserButton: "Open the web version",
    languageLabel: "Language",
    languageSystem: "System",
    languageDe: "German",
    languageEn: "English",

    unconfiguredTitle: "Not set up yet",
    unconfiguredBody:
      "web/firebase-config.js is missing the web app's credentials. Find " +
      "them in the Firebase console under Project settings → My apps → Add " +
      "web app.",
    authChecking: "Checking …",

    signInTitle: "Sign in",
    signInBodyAccount:
      "Use the same Google account as in the app – then you'll see the same " +
      "groups and friends here. Link your account in the app first, under " +
      "Settings → Account, or you'll create a second one here.",
    signInBodyGuest:
      "Or train without an account: level, history and rest time work right " +
      "in this browser. Only friends and groups need signing in later.",
    signInGoogle: "Sign in with Google",
    signInGuest: "Continue as guest",
    signInBackHome: "Back to the homepage",
    signInInviteHint: "You brought an invitation along. Sign in and it will be redeemed right away.",
    signInFailed: (reason) => `Sign-in failed: ${reason}`,
    signInPopupBlocked:
      "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",

    tabTraining: "Training",
    tabFriends: "Friends",
    tabGroups: "Groups",
    tabHistory: "History",
    backBtn: "Back",
    settingsBtn: "Settings",

    yourLevel: "Your level",
    levelOf: (n, total) => `Level ${n} of ${total}`,
    levelSummary: (total, sets, rest) =>
      `${total} reps in ${sets} sets, ${rest} s rest in between.`,
    levelHint: (result, suggested) =>
      `Your test of ${result} in a row suggests level ${suggested}.`,
    startWorkout: "Start workout",
    allLevelsBtn: "Show all levels",
    allLevelsTitle: "All levels",
    allLevelsHint: "Tap a level to switch to it.",
    allLevelsClose: "Close",
    yourLevelSuffix: " · your level",
    yourNumbers: "Your numbers",
    statReps: "Reps",
    statWorkouts: "Workouts",
    statStreak: "Days in a row",
    goalLine: (best, goal, percent) => `Goal: ${best} of ${goal} in a row (${percent}%) — change`,
    goalPrompt: "Your goal",
    goalPromptLabel: "Push-ups in a row",
    goalPromptSave: "Save",
    testLineDone: (n) => `Last max test: ${n} in a row`,
    testLineNone: "No max test yet — that happens in the app.",
    toHistory: "View full history",
    saveFailedTitle: "Not saved",

    connectFirstTitle: "Connect your account first",
    connectFirstBody:
      "Friends and groups need an account. As long as you connect none, " +
      "your training stays entirely on this device.",
    connectFirstAction: "Sign in",
    friendsTitle: "Friends",
    redeemBtn: "Redeem invitation",
    loading: "Loading …",
    inviteFriendBtn: "Invite a friend",
    friendsIncomingHint: "Open requests to you – accepting works in the app:",
    friendsWaiting: "waiting",
    friendsEmpty: "No friends yet.",
    friendsCompare: "Compare",
    friendsUnnamed: "No name",
    groupsTitle: "Groups",
    joinGroupBtn: "Join",
    newGroupBtn: "New group",
    groupsEmpty: "Not in a group yet.",
    groupsSharingPaused: "Sharing paused",
    groupsView: "View",
    groupsUnnamed: "Unnamed group",
    historyTitle: "History",

    settingsTitle: "Settings",
    settingsAccountEmail: (email) => email || "Anonymous account",
    settingsNamePlaceholder: "Display name",
    settingsRestTitle: "Rest between sets",
    settingsRestAdd: "+30 s",
    settingsGuestHint: "Without an account, your training stays on this device.",
    settingsGuestConnect: "You need an account for friends and groups.",
    settingsSignInBtn: "Sign in",
    settingsClose: "Close",
    settingsSave: "Save",
    settingsSignOut: "Sign out",
    signOutTitle: "Sign out",
    signOutBody:
      "You'll be signed out of this browser. Your training on your phone " +
      "stays intact. You can come back any time with the same Google account.",
    signOutConfirm: "Sign out",
    cancel: "Cancel",

    statBestSet: "Best set",
    statBestSession: "Best workout",
    statLast7: "Last 7 days",
    historyEmpty: "No workout recorded yet.",
    historyReps: (n, level) => `${n} reps · level ${level}`,
    deleteBtn: "Delete",
    deleteTitle: "Delete workout",
    deleteBody: "It will also disappear from every group and comparison it was part of.",
    deleteFailedTitle: "Not deleted",

    noAccess: (reason) => `No access: ${reason}`,
    rangeLabel: "Time range",
    range7: "7 days",
    range30: "30 days",
    rangeAll: "All time",
    sortLabel: "Sort by",
    sortReps: "Reps",
    sortBest: "Best",
    sortDays: "Days",
    groupColName: "Name",
    groupColReps: "Reps",
    groupColBest: "Best",
    groupColDays: "Days",
    groupTotal: (total, average) => `Group total ${total} · average ${average}`,
    groupIdLabel: "Group ID:",
    groupManageHint: "Managing, renaming and leaving works in the app.",
    friendGone: "This friendship no longer exists.",
    friendGoneTitle: "No longer connected",
    comparePausedHint: "This person isn't sharing their numbers with you right now.",
    friendManageHint: "Removing, blocking and pausing sharing works in the app.",
    compareRepsLabel: "Reps",
    compareBestLabel: "Best set",
    compareDaysLabel: "Training days",
    compareLevelLabel: "Level",
    compareNeverTrained: "never",
    compareLastTrained: "last trained",

    newGroupTitle: "New group",
    newGroupLabel: "Group name",
    createBtn: "Create",
    createFailedTitle: "Could not create",
    joinGroupTitle: "Join group",
    joinGroupLabel: "Group ID or link",
    nextBtn: "Continue",
    invalidTitle: "Invalid",
    invalidCode: "That doesn't look like a group ID.",
    invalidInviteCode: "That doesn't look like an invitation code.",
    notFoundTitle: "Not found",
    groupNotFound: "There's no group for this code.",
    joinGroupQuestion: (name) => `Join "${name}"? Your training numbers will then show up on this group's leaderboard.`,
    joinBtn: "Join",
    joinFailedTitle: "Could not join",
    inviteCreated: (link) => `The link is on your clipboard and valid for seven days: ${link}`,
    inviteCreatedTitle: "Invitation created",
    redeemTitle: "Redeem invitation",
    redeemLabel: "Code or link",
    inviteNotFound: "There's no invitation for this code.",
    inviteOwn: "You issued this code yourself.",
    inviteOwnTitle: "Your own invitation",
    inviteExpired: "This invitation has expired or was already redeemed. Ask for a new one.",
    inviteExpiredTitle: "No longer valid",
    inviteFrom: (name) => `Invitation from ${name}`,
    inviteFromQuestion: (name) => `Connect with ${name}? You'll then see each other's training numbers.`,
    connectBtn: "Connect",
    redeemFailedTitle: "Could not redeem",
    codeNotFound: "There's neither a group nor an invitation for this code. Maybe a typo, or the invitation was withdrawn.",
    codeNothingFound: "Nothing found",
    codeCheckFailed: (reason) => `Could not check the code: ${reason}`,
    codeCheckFailedTitle: "Something went wrong",
    anonymousName: "Anonymous",
    someoneName: "Someone",
    ok: "OK",

    workoutLevel: (n) => `Level ${n}`,
    workoutPrepareNote: (n) => `First set: ${n} reps`,
    workoutPrepareSet: "Starting soon",
    workoutPrepareUnit: "seconds",
    workoutStartNow: "Start now",
    workoutRest: "Rest",
    workoutGetReady: "Get ready …",
    workoutRestUnit: "seconds rest",
    workoutNextSet: (nr, reps) => `Up next: set ${nr} with ${reps} reps`,
    workoutSkipRest: "Continue",
    workoutSetOf: (n, total) => `Set ${n} of ${total}`,
    workoutTargetOf: (n) => `Target: ${n}`,
    workoutTapHint: "Tap to count",
    workoutThenAlso: (rest) => `Then: ${rest}`,
    workoutLastSet: "Last set",
    workoutFinishSet: "Finish set",
    workoutAbort: "Cancel",
    workoutStop: "End here",
    workoutMinus: "−1",
    workoutPlus: "+1",
    workoutAbortTitle: "End workout?",
    workoutAbortBody: "You can stop here and save the sets you have done, or discard the whole workout.",
    workoutAbortSave: "Finish and save",
    workoutAbortDiscard: "Discard",
    workoutDoneTitle: "Workout done",
    workoutEndedTitle: "Workout ended",
    workoutSummary: (done, sets, list, target, best) =>
      `${done} reps in ${sets} sets (${list}), ${target} were planned. Best set: ${best}.`,
    workoutUploadFailedTitle: "Not fully saved",
    workoutUploadFailed: (reason) =>
      `Your workout was counted, but couldn't be fully uploaded: ${reason}`,
  },
};

/** Aktuell gewaehlte Sprache, oder "system" fuer die Vorgabe des Browsers. */
export function getLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "system";
  } catch {
    return "system";
  }
}

/** Speichert die Wahl und sagt allen offenen Seitenteilen, sich neu zu zeichnen. */
export function setLanguage(lang) {
  try {
    if (lang === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ohne Speicher bleibt die Wahl fuer diesen Aufruf gueltig, ueberlebt nur
    // keinen Seitenwechsel - besser als gar nichts zu tun.
  }
  window.dispatchEvent(new CustomEvent("liegestuetzen:language"));
}

/**
 * "system" wird in eine echte Sprache aufgeloest, genau wie AppLanguage.SYSTEM
 * in der App der Geraetesprache folgt: Englisch, wenn der Browser das meldet,
 * sonst Deutsch als Grundeinstellung dieses Projekts.
 */
export function resolveLanguage() {
  const chosen = getLanguage();
  if (chosen === "de" || chosen === "en") return chosen;
  return (navigator.language || "de").toLowerCase().startsWith("en") ? "en" : "de";
}

/** Schlaegt einen Text nach und fuellt Platzhalter, falls es eine Funktion ist. */
export function t(key, ...args) {
  const dict = STRINGS[resolveLanguage()] || STRINGS.de;
  const entry = dict[key] ?? STRINGS.de[key];
  if (entry === undefined) return key;
  return typeof entry === "function" ? entry(...args) : entry;
}

/**
 * Macht aus einem Knopf die Sprachwahl: Der Knopf heisst schlicht "Sprache"
 * (uebersetzt), ein Klick oeffnet einen kleinen Dialog mit den drei Optionen
 * als Chips. Drei Chips staendig sichtbar nebeneinander waren zu praesent
 * fuer eine Einstellung, die kaum jemand oft anfasst - ein Knopf mit Namen
 * plus ein Dropdown dahinter braucht nur an einer Stelle Platz, nicht ueberall,
 * wo die Sprachwahl vorkommt.
 *
 * Eine Seite ruft dies einmal pro Knopf auf; die Funktion haelt sich selbst
 * aktuell, auch wenn sich die Sprache anderswo aendert. Fuer einen Knopf, der
 * wieder verschwinden kann (z.B. in einem Dialog), gibt sie eine Aufraeum-
 * funktion zurueck, die den window-Listener wieder entfernt.
 */
export function wireLanguagePicker(button) {
  const refreshLabel = () => { button.textContent = t("languageLabel"); };
  refreshLabel();
  window.addEventListener("liegestuetzen:language", refreshLabel);

  button.addEventListener("click", () => {
    const dialog = document.createElement("dialog");
    const current = getLanguage();
    dialog.innerHTML = `
      <h2>${t("languageLabel")}</h2>
      <div class="chips">${LANGUAGE_OPTIONS.map(([value, key]) =>
        `<button type="button" class="chip" data-lang="${value}" aria-pressed="${value === current}">${t(key)}</button>`,
      ).join("")}</div>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove());
    dialog.querySelectorAll("[data-lang]").forEach((chip) =>
      chip.addEventListener("click", () => {
        setLanguage(chip.dataset.lang);
        dialog.close();
      }));
    dialog.showModal();
  });

  return () => window.removeEventListener("liegestuetzen:language", refreshLabel);
}
