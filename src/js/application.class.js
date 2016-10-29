const remote       = require("electron").remote;
const dialog       = remote.dialog;
const app          = remote.app;
const root         = app.getAppPath();
const EventEmitter = require("events");
const path         = require("path");
const fs           = require("fs");
const $            = require("jquery");
const Pool         = require(root + "/js/pool.class.js");
const Model        = require(root + "/js/model.class.js");
const Watcher      = require(root + "/js/watcher.class.js");

class Application {
    
    /*
    *   Application constructor
    *   Setup IHM, create events handler and read default chat logs.
    */
    constructor() {
        // Create objects
        this.eventer = new EventEmitter();
        this.pool = new Pool();
        this.model = new Model();
        this.watcher = new Watcher(this.eventer);
        // Setup IHM
        this.setupIhm();
        // Create events handlers
		this.eventer.on("newLog", (line) => this.pool.add(() => {
            return this.model.parse(line)
                .catch((err) => this.eventer.emit("error", err));
        }));
        this.eventer.on("error", (err) => {
            console.error(err);
            $("#console_contents").append($("<pre/>").text(err.stack));
        });
        // Get and read log file
        this.readLogFile("fleet");
    }
    
    /*
    *   setupIhm()
    *   Initialize HTML (hide hidden DIVs, resize window, define button handlers...).
    */
    setupIhm() {
        // Hide console
        $(".console").hide();
        // Window resizing
        $(window).resize(() => this.resize());
        this.resize();
        // Buttons handlers
        $("#select_chat_btn").click(() => this.changeLogFile());
		$("#help_btn").click(() => $(".help").toggle(300));
        $("#reset_btn").click(() => this.model.reset() || $(".console pre").detach());
		$("#minimize_btn").click(() => remote.getCurrentWindow().minimize());
		$("#close_btn").click(() => remote.getCurrentWindow().close());
        $("#console_btn").click(() => $(".console").toggle(300));
    }
    
    /*
    *   changeLogFile()
    *   Ask user for loading a new file and parse it.
    */
    changeLogFile() {
        // Show file dialog
        let file = dialog.showOpenDialog({
            title: "Change log file",
            defaultPath: path.join(app.getPath("documents"), "EVE", "logs", "Chatlogs"),
            buttonLabel: "Select",
            filters: [
                { name: "Default", extensions: ["txt"] },
                { name: "All", extensions: ["*"] }
            ],
            properties: [ "openFile" ]
        });
        // If use selected a file, watch it (it will unwatch the old one)
        if(typeof file != "undefined" && file.length > 0)
            this.watcher.manage(file[0]);
    }
    
    /*
    *   resize()
    *   Resize section to fit window size.
    */
    resize() {
        let height = $(window).innerHeight() - $("h1").outerHeight() - $("footer").outerHeight();
        $("section").outerHeight(height);
    }
    
    /*
    *   readLogFile()
    *   Get @channel log file and watch it (it will unwatch old file if any).
    */
    readLogFile(channel) {
        return this.getLogFile(channel).then((file) => {
            this.watcher.manage(file);
        }).catch((err) => {
            eventer.emit("error", err);
        });
    }
    
    /*
    *   getLogFile()
    *   Find @channel newest log file and return path.
    */
    getLogFile(channel) {
        const folder = app.getPath("documents") + "/EVE/logs/Chatlogs/";
        return new Promise((resolve, reject) => {
            // Read files name in folder
            fs.readdir(folder, (err, files) => {
                if(err) reject(err);
                else resolve(files);
            });
        }).then((files) => {
            // Filter on file name
            let regexp = new RegExp(channel + ".*", "i");
            return files.filter((name) => name.match(regexp));
        }).then((files) => {
            // Get newest log file
            return this.getNewest(folder, files);
        }).then((file) => {
            // Return path + file
            return folder + file;
        });
    }
    
    /*
    *   getNewest()
    *   Find newest file ba sed on fs.stats from @files list in @folder path.
    */
    getNewest(folder, files) {
        // Get last modified date
        return Promise.all(files.map((name) => {
            return new Promise((resolve, reject) => {
                fs.stat(folder + name, (err, stats) => {
                    if(err) reject(err);
                    else resolve({name: name, stats: stats});
                });
            });
        })).then((files) => {
            // Sort by last modification date
            return files.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
        }).then((files) => {
            // Return first file name
            return files[0].name;
        });
    }
    
}

module.exports = Application;