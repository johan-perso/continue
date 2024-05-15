# Continue

Une application permettant de gérer votre appareil Android depuis votre Mac. Vous pourrez ainsi gérer la musique jouée, les sites récemment visités et le presse-papier du téléphone.

Gestion de la musique      |  Onglets dans le navigateur  | Presse papier            
:-------------------------:|:----------------------------:|:-------------------------:
![player](https://github.com/johan-perso/continue/assets/41506568/eea28e5a-475b-42a4-bf79-73f14db83cab)  |  ![tabs](https://github.com/johan-perso/continue/assets/41506568/23b9be6e-b09b-4b14-9209-649cb13f83c2) | ![clipboard](https://github.com/johan-perso/continue/assets/41506568/fb25ebdb-c10b-42b6-a0b5-b9e45bfb74df)


## Installation

## Windows

L'application n'est pas disponible sur Windows (et Linux) en raison de problèmes avec le design de l'application. Elle a été développée pour être fonctionnelle et il est possible d'adapter le code source pour ces systèmes d'exploitation, mais cela ne sera sûrement pas fait.

## macOS

* Cherchez et téléchargez le fichier `Continue-*-macos-*.dmg` (en fonction de votre architecture, Intel = x64 ; Sillicon = arm64) dans la section [Releases](https://github.com/johan-perso/continue/releases/latest) de ce dépôt.
* Ouvrez le fichier DMG puis déplacez l'application `Continue.app` dans le dossier Applications.

> Pour ouvrir ce fichier sur un processeur Apple Silicon (M1 et supérieur), vous devrez potentiellement exécuter ces commandes dans le terminal :

```bash
sudo spctl --master-disable
sudo chmod -R 777 /Applications/Continue.app
xattr -d com.apple.quarantine /Applications/Continue.app
xattr -cr /Applications/Continue.app
```

## Installation sur Android

Avant le 20 mai


## Licence

MIT © [Johan](https://johanstick.fr)
