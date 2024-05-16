// Importer des librairies
const { app, Menu, Tray, nativeImage, Notification, dialog, clipboard, shell, globalShortcut } = require("electron")
const { networkInterfaces } = require("os")
const fastify = require("fastify")()
var activeWindow
var applescript

// Gérer les exceptions uncaught (active-window par ex)
process.on("uncaughtException", err => {
	console.error("uncaughtException:")
	console.error(err)
	try {
		showNotification("Erreur non reconnue", err.message || err.toString())
	} catch(e){
		console.error("Impossible d'afficher une notification concernant cette exception:", e)
	}
})

// Si l'appli est déjà ouverte en arrière plan, on la focus
const gotTheLock = app.requestSingleInstanceLock()
if(!gotTheLock){
	console.log("Une autre instance de l'app est en cours, on quitte...")
	app.quit()
}

// Obtenir l'IP locale de cet appareil
const localIp = Object.values(networkInterfaces()).flat().filter(i => i.family == "IPv4" && !i.internal)[0]?.address
if(localIp) console.log(`Adresse IP locale: ${localIp}`)

// Configuration
const Store = require("electron-store")
const store = new Store()
console.log(`Chemin des réglages : ${store.path}`)

// Récupérer le port à utiliser pour le serveur local depuis la config
const serverPort = store.has("serverPort") ? parseInt(store.get("serverPort")) : 34334
if(!store.has("serverPort")) store.set("serverPort", serverPort)
console.log("Port du serveur local :", serverPort)

// Récupérer les clés pour le cloud messaging
const cloudMessageSecret = store.get("cloudMessageSecret")
const cloudMessageEmail = store.get("cloudMessageEmail")

// Fonction pour arrêter l'application
function stopApp(){
	// Arrêter l'application normalement
	console.log("Arrêt de l'app...")
	app.quit()

	// Arrêter l'application de force
	setTimeout(() => {
		if(app){
			console.log("On va forcer l'arrêt de l'app puisqu'elle semble toujours démarré...")
			process.exit(0)
		}
	}, 5000)
}

// Déterminer l'onglet ouvert à l'avant plan
async function getFrontTab(){
	// Vérif. os
	if(process.platform != "darwin") return null

	// Importer des libs
	if(!activeWindow) activeWindow = require("active-window")
	if(!applescript) applescript = require("applescript")

	// Obtenir le nom de la fenêtre à l'avant plan
	const window = await new Promise((resolve, reject) => {
		activeWindow.getActiveWindow(window => { resolve(window) })
	})

	// En fonction de l'app ouverte
	if(window == null) return null
	var tabUrl
	if(window?.app == "Arc" || window?.app == "Safari" || window?.app == "Google Chrome") await new Promise((resolve, reject) => {
		applescript.execString(`tell application "${window.app}" ${window.app == "Safari" ? "to get the URL of the front document" : "to get the URL of the active tab of the front window"}`, (err, rtn) => {
			if (err) return reject(err)
			tabUrl = rtn
			resolve()
		})
	})

	// Afficher le nom de l'onglet
	return tabUrl
}

// Afficher une notification native
function showNotification(title, body, callback){
	const notification = new Notification({
		title,
		body
	})
	if(callback) notification.on("click", callback)
	notification.show()
}

// Afficher un dialogue
function showDialog(title, detail, type){
	dialog.showMessageBox({
		message: title,
		title,
		type,
		detail
	})
}

// Envoyer une instruction via le cloud messaging
async function sendCloudMessage(data, type = "string"){
	console.log(`Envoi d'un message cloud (${type == "string" ? data : "json content"})...`)
	var perf = Date.now()
	await fetch("https://llamalab.com/automate/cloud/message", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			secret: cloudMessageSecret,
			to: cloudMessageEmail,
			payload: type == "string" ? `continueclient:${data}` : data
		})
	}).then(res => res.text()).catch(err => {
		console.error("Erreur lors de l'envoi du message cloud :", err)
		return { error: "cloud_message_error" }
	})
	console.log(`Message cloud envoyé en ${Date.now() - perf}ms.`)
}

// Variables
var tray
var deviceName
var deviceBattery
var deviceClipboard = []
var deviceTabs = []
var latestKeepalive = 0

// Fonction principale
async function main(){
	// Vérifier le cloud messaging
	if(!cloudMessageSecret) store.set("cloudMessageSecret", "")
	if(!cloudMessageEmail) store.set("cloudMessageEmail", "")
	if(!cloudMessageSecret || !cloudMessageEmail){
		showDialog("Configuration requise", `Pour permettre à Continue d'envoyer des informations à votre appareil Android, vous devez configurer le cloud messaging pour Automate :\n\n- Rendez-vous sur « https://llamalab.com/automate/cloud » pour générer les infos.\n- Inscrivez les infos dans « ${store.path} ».`, "warning")
	}

	// Déconnecter l'appareil si le keepalive n'est pas reçu dans le temps imparti
	setInterval(() => {
		if(latestKeepalive != 0 && Date.now() - latestKeepalive > 210000){ // 3m30
			latestKeepalive = 0
			tray.setTitle("Continue")
			setTrayContent()
			showNotification("Appareil déconnecté", `La connexion à ${deviceName || "l'appareil distant"} a été perdue.`)
		}
	}, 10000)

	// Envoyer un onglet vers un appareil
	async function sendTabToDevice(){
		const frontTab = await getFrontTab()
		if(frontTab == null) return showDialog("Partager vers l'appareil", "Quelque chose empêche Continue de détecter l'onglet ouvert dans votre navigateur.\nPour utiliser cette fonctionnalité, vous devez :\n\n- Utiliser un navigateur compatible (Safari, Chrome, Arc).\n- Avoir l'application ouverte et mis à l'avant-plan au moment de partager l'onglet.", "error")

		console.log(`Envoi de l'onglet : "${frontTab}"`)
		await sendCloudMessage({ type: "opentab", content: frontTab }, "json")
	}

	// Envoyer le contenu du presse papier
	function sendClipboardContent(){
		const clipboardContent = clipboard.readText()
		if(clipboardContent == "") return showNotification("Partage vers l'appareil", "Aucun élément n'a été trouvé dans le press-papier.")

		console.log(`Envoi du presse papier : "${clipboardContent}"`)
		sendCloudMessage({ type: "setclipboard", content: clipboardContent }, "json")
	}

	// On crée une Tray
	tray = new Tray(nativeImage.createEmpty())
	tray.setTitle("Continue")
	var trayTemplate = [
		{
			id: "music",
			type: "submenu",
			label: "Lecture en cours",
			submenu: [
				{
					id: "toggle",
					label: "Lecture",
					accelerator: "Space",
					click: () => sendCloudMessage("play")
				},
				{
					label: "Précédent",
					accelerator: "Q",
					click: () => sendCloudMessage("previous")
				},
				{
					label: "Suivant",
					accelerator: "D",
					click: () => sendCloudMessage("next")
				},
				{ type: "separator" },
				{
					label: "Volume -",
					accelerator: "A",
					click: () => sendCloudMessage("volume-down")
				},
				{
					label: "Volume +",
					accelerator: "E",
					click: () => sendCloudMessage("volume-up")
				},
				{ type: "separator" },
				{
					id: "title",
					label: "",
					enabled: false,
					visible: false
				},
				{
					id: "artist",
					label: "",
					enabled: false,
					visible: false
				},
				{
					id: "album",
					label: "",
					enabled: false,
					visible: false
				},
			]
		},
		{
			id: "sharedtabs",
			type: "submenu",
			label: "Onglets partagés",
			submenu: [
				process.platform == "darwin" ? {
					label: "Partager depuis ce Mac",
					click: sendTabToDevice
				} : null,
				process.platform == "darwin" ? { type: "separator" } : null
			].filter(Boolean)
		},
		{
			id: "clipboard",
			type: "submenu",
			label: "Presse papier",
			submenu: [
				{
					label: `Partager depuis ce ${process.platform == "darwin" ? "Mac" : "PC"}`,
					click: sendClipboardContent
				},
				{ type: "separator" }
			]
		},
		{ type: "separator" },
		{ id: "battery-percentage", label: "Batterie :", enabled: false, visible: false },
		{ id: "battery-status", label: "Statut inconnu", enabled: false, visible: false },
		{ type: "separator" },
		{
			id: "settings",
			type: "submenu",
			label: "Débogage",
			submenu: [
				{
					label: "Ouvrir la configuration",
					click: () => shell.openPath(store.path)
				},
				{
					label: "Ouvrir au démarrage",
					click: () => {
						app.setLoginItemSettings({
							openAtLogin: true,
							name: "Continue",
							path: app.getPath("exe")
						})
					}
				},
				{ type: "separator" },
				{
					id: "serverStatus",
					label: "Serveur : non démarré",
					enabled: false
				},
				{
					id: "lastRequest",
					label: "Dernière requête :",
					enabled: false,
					visible: false
				},
				{
					id: "deviceStatus",
					label: "Statut : appareil déconnecté",
					enabled: false
				}
			]
		},
		{
			label: "Quitter",
			accelerator: "CmdOrCtrl+Q",
			click: () => stopApp()
		},
	]
	function setTrayContent(){
		// Masquer certains éléments si l'appareil est déconnecté
		trayTemplate.find(i => i.id == "music").enabled = latestKeepalive != 0
		trayTemplate.find(i => i.id == "sharedtabs").enabled = latestKeepalive != 0
		trayTemplate.find(i => i.id == "clipboard").enabled = latestKeepalive != 0
		if(latestKeepalive == 0){
			trayTemplate.find(i => i.id == "battery-percentage").visible = false
			trayTemplate.find(i => i.id == "battery-status").visible = false // on affichera ces éléments à nouveau quand on reçoit une update pour ceux-ci
			tray.setTitle("Continue")
		} else tray.setTitle(deviceName || "Appareil distant")

		// Définir certaines valeurs à partir de variables
		if(latestKeepalive){
			trayTemplate.find(i => i.id == "settings").submenu.find(i => i.id == "lastRequest").label = `Dernière requête : ${new Date(latestKeepalive).toLocaleTimeString()}`
			trayTemplate.find(i => i.id == "settings").submenu.find(i => i.id == "lastRequest").visible = true
		} else trayTemplate.find(i => i.id == "settings").submenu.find(i => i.id == "lastRequest").visible = false
		trayTemplate.find(i => i.id == "settings").submenu.find(i => i.id == "deviceStatus").label = `Statut : ${latestKeepalive ? "appareil connecté" : "appareil déconnecté"}`

		// Ajouter les éléments du presse papier
		var clipboardMenu = trayTemplate.find(i => i.id == "clipboard").submenu
		clipboardMenu = clipboardMenu.filter(i => i.id != "item")
		if(deviceClipboard.length) deviceClipboard.forEach((item, index) => {
			clipboardMenu.push({
				id: "item",
				label: item.length > 40 ? `${item.substring(0, 40)}...` : item,
				click: () => clipboard.writeText(item)
			})
		})
		else clipboardMenu.push({ label: "Aucun élément récemment copié", enabled: false, id: "item" })
		trayTemplate.find(i => i.id == "clipboard").submenu = clipboardMenu

		// Ajouter les onglets partagés
		var sharedTabsMenu = trayTemplate.find(i => i.id == "sharedtabs").submenu
		sharedTabsMenu = sharedTabsMenu.filter(i => i.id != "item")
		if(deviceTabs.length) deviceTabs.forEach((item, index) => {
			sharedTabsMenu.push({
				id: "item",
				label: item.short.length > 40 ? `${item.short.substring(0, 40)}...` : item.short,
				click: () => shell.openExternal(item.complete)
			})
		})
		else sharedTabsMenu.push({ label: "Aucun onglet récemment visité", enabled: false, id: "item" })
		trayTemplate.find(i => i.id == "sharedtabs").submenu = sharedTabsMenu

		// Définir le menu de la tray
		var trayContextMenu = Menu.buildFromTemplate(trayTemplate)
		tray.setContextMenu(trayContextMenu)
	}
	setTrayContent()

	// Routes du serveur local
	fastify.get("/", async (req, reply) => {
		return { hello: "world" }
	})
	fastify.post("/name", async (req, reply) => { // définir le nom de l'appareil
		console.log("Requête reçue : POST /name")
		latestKeepalive = Date.now()

		var name = req.body
		if(!name) return reply.code(400).send({ error: "missing_body" })
		else deviceName = name.substring(0, 38).trim()

		if(!deviceName?.length) return reply.code(400).send({ error: "invalid_body" })

		console.log(`Définir le nom de l'appareil distant : ${deviceName}`)
		setTrayContent()
		reply.send({ success: true })
	})
	fastify.post("/clipboard", async (req, reply) => { // ajouter un élément au presse papier
		console.log("Requête reçue : POST /clipboard")
		latestKeepalive = Date.now()

		var content = req.body
		if(!content) return reply.code(400).send({ error: "missing_body" })
		if(!content?.length) return reply.code(400).send({ error: "invalid_body" })

		if(deviceClipboard.includes(content)) deviceClipboard.splice(deviceClipboard.indexOf(content), 1) // on retire l'élément s'il est déjà présent
		deviceClipboard.unshift(content)
		if(deviceClipboard.length > 13) deviceClipboard.pop() // max 13 éléments

		setTrayContent()
		reply.send({ success: true })
	})
	fastify.post("/tab", async (req, reply) => { // ajouter un élément dans la liste des onglets
		console.log("Requête reçue : POST /tab")
		latestKeepalive = Date.now()

		var content = req.body
		if(!content) return reply.code(400).send({ error: "missing_body" })
		if(!content?.length) return reply.code(400).send({ error: "invalid_body" })
		if(content == "Rechercher ou saisir une URL") return reply.code(400).send({ error: "refused_body" })

		if(!content.startsWith("http")) content = `https://${content}`

		if(deviceTabs.find(i => i.complete == content)) deviceTabs.splice(deviceTabs.findIndex(i => i.complete == content), 1) // on retire l'élément s'il est déjà présent
		deviceTabs.unshift({
			complete: content,
			short: content.replace("https://", "").replace("http://", "").replace("www.", "")
		})
		if(deviceTabs.length > 13) deviceTabs.pop() // max 13 éléments

		setTrayContent()
		reply.send({ success: true })
	})
	fastify.post("/battery", async (req, reply) => { // définir le niveau de batterie
		console.log("Requête reçue : POST /battery")
		latestKeepalive = Date.now()

		var { percentage, charging } = req.body
		if(!parseInt(percentage)) return reply.code(400).send({ error: "missing_percentage" })
		else if(percentage < 0 || percentage > 100) return reply.code(400).send({ error: "invalid_percentage" })

		trayTemplate.find(i => i.id == "battery-percentage").label = `Batterie : ${Math.round(percentage)}%`
		trayTemplate.find(i => i.id == "battery-percentage").visible = true
		trayTemplate.find(i => i.id == "battery-status").label = charging ? "En charge" : "Débranché"
		trayTemplate.find(i => i.id == "battery-status").visible = true
		setTrayContent()

		// On envoie une notification à certains palliers de batterie
		if(deviceBattery != percentage && charging && percentage == 100) showNotification("Batterie pleine", `La batterie de votre ${deviceName || "appareil"} est pleine.`)
		if(deviceBattery != percentage && !charging){
			if(percentage == 20) showNotification("Batterie faible", `La batterie de votre ${deviceName || "appareil"} est faible (20 %).`)
			else if(percentage == 10) showNotification("Batterie faible", `La batterie de votre ${deviceName || "appareil"} est faible (10 %).`)
			else if(percentage == 5) showNotification("Batterie critique", `Le niveau de batterie de votre ${deviceName || "appareil"} est critique.`)
			else if(percentage == 3) showNotification("Batterie critique", `Le niveau de batterie de votre ${deviceName || "appareil"} est critique.`)
			else if(percentage == 2) showNotification("Batterie critique", `Le niveau de batterie de votre ${deviceName || "appareil"} est critique.`)
			else if(percentage == 1) showNotification("Batterie critique", `Le niveau de batterie de votre ${deviceName || "appareil"} est critique.`)
		}
		deviceBattery = percentage

		reply.send({ success: true })
	})
	fastify.post("/keepalive", async (req, reply) => {
		console.log("Requête reçue : POST /keepalive")
		latestKeepalive = Date.now()
		setTrayContent()
		reply.send({ success: true })
	})
	fastify.post("/music", async (req, reply) => { // infos du lecteur de musique
		console.log("Requête reçue : POST /music")
		latestKeepalive = Date.now()

		var { title, artist, album, playing } = req.body
		if(playing && !title) return reply.code(400).send({ error: "missing_title" })
		if(playing && !artist) return reply.code(400).send({ error: "missing_artist" })

		if(playing) console.log(`Lecture en cours : ${title} - ${artist} (${album || "Album inconnu"})`)
		else console.log("Lecture en pause")

		var musicMenu = trayTemplate.find(i => i.id == "music").submenu
		var titleMenu = musicMenu.find(i => i.id == "title")
		var artistMenu = musicMenu.find(i => i.id == "artist")
		var albumMenu = musicMenu.find(i => i.id == "album")

		if(title){
			titleMenu.label = title
			titleMenu.visible = true
		} else titleMenu.visible = false
		if(artist){
			artistMenu.label = artist
			artistMenu.visible = true
		} else artistMenu.visible = false
		if(album){
			albumMenu.label = album
			albumMenu.visible = true
		} else albumMenu.visible = false

		musicMenu.find(i => i.id == "toggle").label = playing ? "Pause" : "Lecture"
		musicMenu.find(i => i.id == "toggle").click = () => sendCloudMessage(playing ? "pause" : "play")

		setTrayContent()
		reply.send({ success: true })
	})

	// Démarrer un serveur local pour recevoir des informations depuis l'appareil
	fastify.listen({ port: serverPort, host: "0.0.0.0" }, (err) => {
		if(err){
			showDialog("Impossible de démarrer le serveur", err.message || err, "error")
			return process.exit(1)
		}
		console.log(`Serveur démarré sur le port ${fastify.server.address().port}`)
		trayTemplate.find(i => i.id == "settings").submenu.find(i => i.id == "serverStatus").label = `Serveur : ${localIp || "IP locale inconnue"}:${fastify.server.address().port}`
		setTrayContent()
	})
}

// Quand Electron est prêt
app.whenReady().then(async () => {
	main() // on démarre

	// Ajouter un raccourci clavier pour afficher le menu
	globalShortcut.register("Control+Alt+Command+Shift+C", () => {
		if(tray) tray.popUpContextMenu()
	})

	// Masquer l'app du dock
	if(process.platform == "darwin") app.dock.hide()
})