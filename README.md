# Continue

Une application permettant de gérer votre appareil Android depuis votre Mac. Vous pourrez ainsi gérer la musique jouée, les sites récemment visités et le presse-papier du téléphone.

Gestion de la musique      |  Onglets dans le navigateur  | Presse papier            
:-------------------------:|:----------------------------:|:-------------------------:
![player](https://github.com/johan-perso/continue/assets/41506568/eea28e5a-475b-42a4-bf79-73f14db83cab)  |  ![tabs](https://github.com/johan-perso/continue/assets/41506568/23b9be6e-b09b-4b14-9209-649cb13f83c2) | ![clipboard](https://github.com/johan-perso/continue/assets/41506568/fb25ebdb-c10b-42b6-a0b5-b9e45bfb74df)


## Installation sur Mac

> L'application n'est pas disponible sur d'autres systèmes en raison de son design. Elle a été développée pour être fonctionnelle sur les trois principales plateformes et il est possible d'adapter le code source pour ces systèmes d'exploitation, mais cela ne sera sûrement pas fait.

## macOS

- Cherchez et téléchargez le fichier `Continue-*-macos-*.dmg` (en fonction de votre architecture, Intel = x64 ; Sillicon = arm64) dans la section [Releases](https://github.com/johan-perso/continue/releases/latest) de ce dépôt.
- Ouvrez le fichier DMG puis déplacez l'application `Continue.app` dans le dossier Applications.

> Pour ouvrir ce fichier sur un processeur Apple Silicon (M1 et supérieur), vous devrez potentiellement exécuter ces commandes dans le terminal :

```bash
sudo spctl --master-disable
sudo chmod -R 777 /Applications/Continue.app
xattr -d com.apple.quarantine /Applications/Continue.app
xattr -cr /Applications/Continue.app
```

## Installation sur Android

### Prérequis

- Vous aurez potentiellement besoin d’être rooté pour utiliser Continue.
- Pour exécuter Continue sur Android, il sera requis d’installer [Automate](https://llamalab.com/automate/) ([Télécharger via le Play Store](https://play.google.com/store/apps/details?id=com.llamalab.automate)), une application permettant de créer des automatisations complètes.
- La version payante d’Automate (4€ à vie via un achat in-app) sera nécessaire.

### Préparer l'automatisation

1. [Télécharger le fichier](https://github.com/johan-perso/continue/blob/main/Continue%20Client.flo) `.flo` ici et importer le dans Automate
2. Cocher les différentes permissions pour permettre à l’automatisation de pleinement s’exécuter
3. [Générer une clé secrète](https://llamalab.com/automate/cloud/#secret) pour utiliser le service de Cloud Messaging (garder la pour plus tard)

### Configurer l’app sur Mac

1. Cliquer sur l’icône de Continue dans la barre de menu en haut à droite sur votre écran
2. Déroulez le sous-menu "Débogage" et ouvrez la configuration
3. (optionnel) Vous pouvez gérer le port utilisé par le serveur dans ce fichier
4. Ajouter votre clé secrète obtenue dans l’étape précédente, et un mail que vous utiliserez sur votre appareil Android
5. Dans le sous-menu Débogage de Continue, vous trouverez aussi l’IP locale du serveur, garder la pour la prochaine étape

### Configurer l’automatisation

1. Ouvrez les détails de l’automatisation sur Automate, et éditez là via le bouton en bas à droite (icône de crayon)
2. Éditez le bloc #190 ("Set variable serverUrl") et ajoutez y l’IP locale de votre serveur sous cette forme : `http://<votre ip locale>/`
3. Éditer le bloc #39 ("Set variable cloudMessageAccount") et ajouter y le mail que vous avez entré lors de la configuration de l’app sur Mac

### Démarrer l’automatisation

1. Revenez en arrière et cliquez sur "Start" pour la démarrer
2. Revenez encore en arrière et ouvrez les réglages, allez vers le bas et cochez "Run on system startup" pour démarrer Continue lorsque votre téléphone s’allume


## Licence

MIT © [Johan](https://johanstick.fr). Soutenez moi via [Ko-Fi](https://ko-fi.com/johan_stickman) ou [PayPal](https://paypal.me/moipastoii) si vous souhaitez m'aider 💙