// copyright (c) 2017 David Betz

const fs = require('fs');
const path = require('path');

const beginre = /@@begin\|([0-9a-zA-Z_]+)\:([0-9a-zA-Z_]+)@@/;
const subre = /^@@([0-9a-zA-Z_]+)\:([0-9a-zA-Z_]+)@@/;
const startmetare = /^@([0-9a-zA-Z_\|]+)@(.*)/;
const metare = /@@([0-9a-zA-Z_]+)\|([0-9a-zA-Z_]+)@@/;

exports.read = function (input) {
    input = input.replace(/\r\n/g, '\n');
    let obj = {}
    let body = []
    let index = 0
    let section_data = null
    let content = {}
    let format_content = null
    for (let line of input.split('\n')) {
        if (line.length == 0)
            continue
        if (line.startsWith('@@')) {
            if (line.startsWith('@@begin|')) {
                let beginresult = beginre.exec(line)
                if (beginresult != null) {
                    let [, type, code] = beginresult
                    content[index] = body.join('\n')
                    index = index + 1
                    body = []
                    section_data = { 'type': type, 'code': code }

                    format_index = 0
                    format_content = {}
                }
            }
            else if (section_data != null && line.startsWith('@@')) {
                if (line == '@@end@@') {
                    if (format_content == null) {
                        content[index] = {
                            '_': body.join('\n')
                        }
                        content[index][section_data['type']] = section_data['code']
                    }
                    else {
                        format_content[format_index] = {
                            '_': body.join('\n')
                        }
                        format_content[index][section_data['type']] = section_data['code']
                        content[index] = format_content
                    }

                    index = index + 1
                    body = []
                    section_data = null
                    format_content = null
                }
                else {
                    let switchresult = subre.exec(line)
                    if (switchresult != null) {
                        let [, type, code] = switchresult
                        if (format_content == null) {
                            format_content = {}
                            format_index = 0
                        }
                        format_content[format_index] = {
                            '_': body.join('\n')
                        }
                        format_content[format_index][section_data['type']] = section_data['code']
                        section_data = { 'type': type, 'code': code }
                        format_index = format_index + 1
                        body = []
                    }
                }
            }
        }
        else if (line[0] == '@') {
            let startmetaresult = startmetare.exec(line)
            if (startmetaresult != null) {
                let [, tag_type, tag_content] = startmetaresult
                tag_content = tag_content.trim()
                if (tag_type.indexOf('|') > -1) {
                    let [bar_left, bar_right] = tag_type.split('|', 1)
                    obj[bar_left] = {
                        bar_right: tag_content
                    }
                }
                else {
                    //+ don't save most stuff with prefix; it's my universal code for disabled (or system)
                    //+   it's VERY common to overwrite _created and _modified (since they are often killed
                    //+   when they go across FTP; but you can't mess with immutable stuff (e.g. filename)
                    if (!tag_type.startsWith('_') || tag_type == '_created' || tag_type == '_modified') {
                        obj[tag_type] = tag_content
                    }
                }
            }
        }
        else {
            // let metaresult = metare.exec(line)
            // if (metaresult != null) {
            //     let [, type, code] = metaresult
            //     //+ don't really do anything; just good to know about
            // }

            body.push(line)
        }
    }

    if (body.length > 0) {
        content[index] = body.join('\n')
        obj['_'] = content
    }

    return obj
}

exports.read_file = function (filepath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, 'utf8', function (err, data) {
            if (err) throw reject(err);

            obj = exports.read(data)

            fs.stat(filepath, (err, file_data) => {
                if (err) throw reject(err);
                //+ due to a file system design flaw, not all file systems have a file created date
                if (!obj['_created']) {
                    obj['_created'] = file_data.ctime
                }
                if (!obj['_modified']) {
                    obj['_modified'] = file_data.mtime
                }
                obj['_filename'] = path.basename(filepath)

                const _filename = obj['_filename'];
                let lio = _filename.lastIndexOf('.');
                if (lio == -1) {
                    obj['_extension'] = _filename.substring(1, lio - 1)
                    obj['_basename'] = ''
                }
                else {
                    const first = _filename.substring(0, lio);
                    const second = _filename.substring(lio + 1, _filename.length);
                    obj['_extension'] = second != '.' ? second : second.substring(1)
                    obj['_basename'] = first
                }

                return resolve(obj);
            })
        });
    });
}