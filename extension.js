const vscode    = require('vscode');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const openedFileNames = [];

function checkExistsWithTimeout(filePath, timeout) {
    return new Promise(function (resolve, reject) {

        var timer = setTimeout(function () {
            watcher.close();
            reject(new Error('File did not exists and was not created during the timeout.'));
        }, timeout);

        fs.access(filePath, fs.constants.R_OK, function (err) {
            if (!err) {
                clearTimeout(timer);
                watcher.close();
                resolve();
            }
        });

        var dir = path.dirname(filePath);
        var basename = path.basename(filePath);
        var watcher = fs.watch(dir, function (eventType, filename) {
            if (eventType === 'rename' && filename === basename) {
                clearTimeout(timer);
                watcher.close();
                resolve();
            }
        });
    });
}

function activate(context) {
	vscode.workspace.onDidOpenTextDocument(e => {
		var fileName = e.fileName
		const ext = fileName.split('.').reverse()[0];

		switch(ext) {
			case 'ymap':
			case 'ytyp':
			case 'ymt': {
				openedFileNames.push(fileName + '.xml');

				const gtautil = spawn('gtautil', ['exportmeta', '-i', fileName.substring(fileName.lastIndexOf('\\')+1, fileName.length)], {
					cwd: fileName.substring(0, fileName.lastIndexOf("\\")+1)
				});

				gtautil.stdout.on('data', data => {
					//console.log('STDOUT : ' + data);
				});

				gtautil.stderr.on('data', data => {
					//console.log('STDERR : ' + data);
				});

				gtautil.on('exit', code => {
					checkExistsWithTimeout(fileName + '.xml', 5000).then(_ => {
						const openPath = vscode.Uri.parse('file:///' + fileName + '.xml');

						vscode.commands.executeCommand('workbench.action.closeActiveEditor')
						vscode.workspace.openTextDocument(openPath).then(doc => {
							 vscode.window.showTextDocument(doc);
						});
					}).catch(_ => {
						vscode.window.showErrorMessage('GTAUtil failed at exporting an xml for this file within 5s')
					})
				});
				break;
			}

			default: break;
		}
	});

	vscode.workspace.onDidCloseTextDocument(e => {
		const fileName = e.fileName.replace('.git', '')
		const idx = openedFileNames.indexOf(fileName);

		if(idx !== -1) {
			fs.unlink(fileName, (err) => {
				if (err) throw err;
			})
			openedFileNames.splice(idx, 1);
		}
	});

	vscode.workspace.onDidSaveTextDocument(e => {
		if(openedFileNames.indexOf(e.fileName) !== -1) {
			const gtautil = spawn('GTAUtil', ['importmeta', '-i', e.fileName]);

			gtautil.stdout.on('data', data => {
				console.log(data);
			});

			gtautil.stderr.on('data', data => {
				console.log(data);
			});
		}

	});
}

exports.activate = activate;
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
