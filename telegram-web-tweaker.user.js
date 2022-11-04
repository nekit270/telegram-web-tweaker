// ==UserScript==
// @name         Telegram Web Tweaker
// @namespace    http://nekit270.42web.io
// @version      1.3
// @description  Добавляет новые функции в Telegram
// @author       nekit270
// @match        http://web.telegram.org/k/*
// @match        https://web.telegram.org/k/*
// @icon         https://web.telegram.org/favicon.ico
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    let w = (window.unsafeWindow)?(window.unsafeWindow):(window); if(w.self != w.top) return;

    const VERSION = '1.3';
    let hTimes = 0;
    let hidden = false;
    window.addEventListener('keypress', (e)=>{
        if(e.key == 'H'){
            hTimes++;
            if(hTimes > 2){
                hTimes = 0;
                hidden = !hidden;
                document.body.style.display = (hidden?'none':'block');
            }
        }
    });

    setTimeout(function checkChats(){
        if(document.querySelector('a.chatlist-chat')){
            let s = document.createElement('script');
            s.src = 'https://nekit270.github.io/bcsh/bcsh.js';
            s.dataset.twLib = '';
            s.onload = startTweaker;
            document.body.appendChild(s);
        }else{
            setTimeout(checkChats, 200);
        }
    }, 200);

    function startTweaker(){
        console.log('Telegram Web Tweaker '+VERSION);
        GM.registerMenuCommand('Настройки', ()=>{w.optionsUI()});
        GM.registerMenuCommand('Интерфейс', ()=>{w.interfaceConfigUI()});
        GM.registerMenuCommand('Скрытые чаты', ()=>{w.hiddenChatsUI()});
        GM.registerMenuCommand('Блокировщик рекламы', ()=>{w.adBlockerUI()});
        GM.registerMenuCommand('Скрипты', ()=>{w.scriptsUI()});
        setupBCSH();

        let chatList = document.querySelector('ul.chatlist');
        let pinBtn = null;
        if(!localStorage.pinnedChats) localStorage.pinnedChats = '[]';
        let pinnedChats = JSON.parse(localStorage.pinnedChats || '[]');
        if(!localStorage.hiddenChats) localStorage.hiddenChats = '[]';
        let hiddenChats = JSON.parse(localStorage.hiddenChats || '[]');
        if(!localStorage.scriptList) localStorage.scriptList = '[]';
        let scriptList = JSON.parse(localStorage.scriptList || '[]');
        if(!localStorage.interfaceConfig){
            localStorage.interfaceConfig = `{
                "hide-emoji-helper": {
                    "title": "Убрать всплывающее окно с эмодзи",
                    "type": "boolean",
                    "value": true,
                    "exec": "document.querySelectorAll('.emoji-helper-emojis').forEach(e=>e.parentNode.removeChild(e))"
                },
                "in-message-style": {
                    "title": "CSS-стиль входящих сообщений",
                    "type": "string",
                    "value": "",
                    "exec": "document.querySelectorAll('div.bubble.is-in').forEach(e=>e.setAttribute('style', value))"
                },
                "out-message-style": {
                    "title": "CSS-стиль исходящих сообщений",
                    "type": "string",
                    "value": "",
                    "exec": "document.querySelectorAll('div.bubble.is-out').forEach(e=>e.setAttribute('style', value))"
                },
                "chat-background": {
                    "title": "Цвет фона чата",
                    "type": "string",
                    "value": "",
                    "exec": "document.querySelector('.bubbles').style.background = value"
                }
            }`;
        }
        let interfaceConfig = JSON.parse(localStorage.interfaceConfig || '{}');
        if(!localStorage.adBlockerFilters){
            localStorage.adBlockerFilters = `
            [
                {
                    "name": "default",
                    "description": "Стандартный фильтр.",
                    "only_channels": true,
                    "enabled": true,
                    "filters": [
                        {
                            "text_contains": ["t.me/", "@"],
                            "html_contains": ["onclick=\\"joinchat(this)\\"", "onclick=\\"im(this)\\""]
                        },
                        {
                            "text_contains": ["Читать полностью", "Читать продолжение", "читать полностью", "читать продолжение"]
                        }
                    ]
                }
            ]`;
        }
        let adBlockerFilters = JSON.parse(localStorage.adBlockerFilters || '[]');

        let p = location.search.replace('?', '').split('&');
        p.forEach((e,i,o)=>{
            e = e.split('=');
            let name = e[0], value = decodeURIComponent(e[1]);
            switch(name){
                case 'tw_add_filter': {
                    filterAdd(value);
                    break;
                }
                case 'tw_configure_interface': {
                    let conf = value.split(':');
                    console.log(conf[0], interfaceConfig[conf[0]], conf[1]);
                    interfaceConfig[conf[0]].value = conf[1];
                    localStorage.interfaceConfig = JSON.stringify(interfaceConfig);
                    break;
                }
                case 'tw_eval': {
                    w.eval(value);
                    break;
                }
            }
        });

        setInterval(setPinnedState, 400);
        setInterval(execScripts, 1000);
        setInterval(()=>{
            if(!document.querySelector('.tw-chat-menu-btn')) try{ addElemsToChatMenu() }catch(e){}
            if(chatList.firstChild?.dataset.twPinned != 'true') pinChats(1);
            document.querySelectorAll('a.chatlist-chat').forEach((e,i,o)=>{e.oncontextmenu = ()=>{setTimeout(updatePinBtn, 210)}});
            if(document.querySelector('a.chatlist-chat.menu-open')){
                document.querySelectorAll('.tw-chat-menu-btn').forEach((e)=>{e.style.display = ''});
            }else{
                document.querySelectorAll('.tw-chat-menu-btn').forEach((e)=>{e.style.display = 'none'});
            }
            hideChats();
            adBlocker();
            configureInterface();
        }, 300);

        setTimeout(function checkOptionsMenu(){
            if(document.querySelector('div.btn-menu.bottom-right.has-footer')){
                addElemsToOptionsMenu();
            }else{
                setTimeout(checkOptionsMenu, 200);
            }
        }, 200);

        function addElemsToDialogMenu(){
            console.log('Добавление элементов в меню диалога...');
            let dialogMenu = document.querySelector('div.btn-menu.bottom-left');

            let dl = document.createElement('div');
            dl.className = 'btn-menu-item rp-overflow tgico-download';
            dl.innerText = 'Скачать чат';
            dl.addEventListener('click', downloadChat);
            dialogMenu.appendChild(dl);
        }

        function setPinnedState(){
            document.querySelectorAll('a.chatlist-chat').forEach((e,i,o)=>{
                let isPinned = (pinnedChats.indexOf(e.dataset.peerId) > -1);
                e.dataset.twPinned = isPinned.toString();
            });
            pinChats();
        }

        function pinChats(f){
            document.querySelectorAll('a.chatlist-chat').forEach((e,i,o)=>{
                if(e.dataset.twPinned == 'true' && (e.dataset.twReallyPinned != 'true' || f)){
                    let chatList = e.parentNode;
                    chatList.removeChild(e);
                    chatList.insertBefore(e, chatList.firstChild);
                    e.dataset.twReallyPinned = 'true';
                }
            });
        }

        function updatePinBtn(){
            let selectedChat = document.querySelector('a.chatlist-chat.menu-open');
            if(!selectedChat || !pinBtn) return;
            if(selectedChat.dataset.twPinned == 'true'){
                pinBtn.className = 'btn-menu-item rp-overflow tgico-unpin';
                pinBtn.innerText = 'TW-Открепить';
                pinBtn.onclick = ()=>{ unpinChat(selectedChat) };
            }else{
                pinBtn.className = 'btn-menu-item rp-overflow tgico-pin';
                pinBtn.innerText = 'TW-Закрепить';
                pinBtn.onclick = ()=>{ pinChat(selectedChat) };
            }
        }

        function pinChat(chat){
            pinnedChats.push(chat.dataset.peerId);
            localStorage.pinnedChats = JSON.stringify(pinnedChats);
        }

        function unpinChat(chat){
            pinnedChats.splice(pinnedChats.indexOf(chat.dataset.peerId), 1);
            localStorage.pinnedChats = JSON.stringify(pinnedChats);
        }

        function addElemsToChatMenu(){
            let chatMenu = document.querySelector('div.btn-menu.contextmenu');

            let hide = document.createElement('div');
            hide.className = 'btn-menu-item rp-overflow tgico-stop danger tw-chat-menu-btn';
            hide.innerText = 'Скрыть чат';
            hide.addEventListener('click', ()=>{hideChat(document.querySelector('a.chatlist-chat.menu-open'))});
            chatMenu.appendChild(hide);

            pinBtn = document.createElement('div');
            pinBtn.className = 'btn-menu-item rp-overflow tgico-pin tw-chat-menu-btn';
            pinBtn.innerText = 'TW-Закрепить';
            chatMenu.appendChild(pinBtn);

            let gid = document.createElement('div');
            gid.className = 'btn-menu-item rp-overflow tgico-info tw-chat-menu-btn';
            gid.innerText = 'ID чата';
            gid.addEventListener('click', ()=>{
                let id = document.querySelector('a.chatlist-chat.menu-open').dataset.peerId;
                w.popup('ID чата', `<h2>${id}</h2>`, [
                    {
                        text: 'Скопировать',
                        type: 'primary',
                        onclick: ()=>{
                            function oldCopy(text){
                                let t = document.createElement('input');
                                t.type = 'text';
                                t.value = text;
                                document.body.appendChild(t);
                                t.select();
                                document.execCommand('copy');
                                document.body.removeChild(t);
                            }

                            if(navigator.clipboard){
                                try{
                                    navigator.clipboard.writeText(id);
                                }catch(e){
                                    oldCopy(id);
                                }
                            }else{
                                oldCopy(id);
                            }
                        }
                    },
                    {
                        text: 'OK',
                        type: 'primary'
                    }
                ]);
            });
            chatMenu.appendChild(gid);

            let twopt = document.createElement('div');
            twopt.className = 'btn-menu-item rp-overflow tgico-settings tw-chat-menu-btn';
            twopt.innerText = 'Настройки твикера';
            twopt.addEventListener('click', w.optionsUI);
            chatMenu.appendChild(twopt);
        }

        function hideChat(chat){
            chat.style.display = 'none';
            hiddenChats.push({name: chat.querySelector('.user-caption .dialog-title .user-title .peer-title').innerText, id: chat.dataset.peerId});
            localStorage.hiddenChats = JSON.stringify(hiddenChats);
        }

        function hideChats(){
            hiddenChats.forEach((e,i,o)=>{
                let chat = document.querySelector(`a.chatlist-chat[data-peer-id="${e.id}"]`);
                if(chat && chat.style.display != 'none') chat.style.display = 'none';
            });
        }

        function addElemsToOptionsMenu(){
            let optionsMenu = document.querySelector('div.btn-menu.bottom-right.has-footer');

            let twSet = document.createElement('a');
            twSet.href = 'javascript:window.tweakerUI()';
            twSet.onclick = w.tweakerUI;
            twSet.className = 'btn-menu-footer';
            twSet.innerHTML = `<span class="btn-menu-footer-text">Telegram Web Tweaker ${VERSION}</span>`;
            optionsMenu.appendChild(twSet);
        }

        w.tweakerUI = function(){
            w.popup('Telegram Web Tweaker '+VERSION, `
                Возможности:
                <ul>
                    <li>&nbsp;&nbsp;&nbsp;&nbsp;• Блокировка рекламы</li>
                    <li>&nbsp;&nbsp;&nbsp;&nbsp;• Закрепление неограниченного количества чатов</li>
                    <li>&nbsp;&nbsp;&nbsp;&nbsp;• Скрытие чатов</li>
                    <li>&nbsp;&nbsp;&nbsp;&nbsp;• Получение ID чата</li>
                    <li>&nbsp;&nbsp;&nbsp;&nbsp;• Экспорт чата в текстовый файл (бета)</li>
                </ul>
            `,
            [
                {
                    text: 'Закрыть',
                    type: 'danger'
                },
                {
                    text: 'Другие скрипты',
                    type: 'primary',
                    onclick: ()=>{
                        open('http://nekit270.42web.io/userscripts');
                    }
                },
                {
                    text: 'Настройки',
                    type: 'primary',
                    onclick: w.optionsUI
                }
            ]);
        }

        w.optionsUI = function(){
            w.popup('Настройки', `
                <div class="btn-menu-item" style="font-size: 100%" onclick="window.interfaceConfigUI()"><span class="i18n">Интерфейс</span></div>
                <div class="btn-menu-item" style="font-size: 100%" onclick="window.hiddenChatsUI()"><span class="i18n">Скрытые чаты</span></div>
                <div class="btn-menu-item" style="font-size: 100%" onclick="window.adBlockerUI()"><span class="i18n">Блокировщик рекламы</span></div>
                <div class="btn-menu-item" style="font-size: 100%" onclick="window.scriptsUI()"><span class="i18n">Скрипты</span></div>
            `, [{text: 'Закрыть', type: 'danger'}], {closeOnClick: true});
        }

        w.hiddenChatsUI = function(){
            let tb = document.createElement('table');
            tb.style.maxHeight = '300px';
            tb.style.overflow = 'auto';
            hiddenChats.forEach((e,i,o)=>{
                let tr = document.createElement('tr');
                let c = document.createElement('td');
                c.className = 'btn-menu-item rp';
                c.innerText = e.name;
                c.title = 'Открыть чат';
                c.addEventListener('click', ()=>{
                    location.hash = '#'+e.id;
                });

                let btd = document.createElement('td');
                let bd = document.createElement('button');
                bd.className = 'btn danger rp tgico-delete';
                bd.style.padding = '3px';
                bd.style.marginLeft = '5px';
                bd.style.fontSize = '150%';
                bd.title = 'Удалить чат';
                bd.addEventListener('click', ()=>{
                    w.popup('Удалить чат', `Вы точно хотите удалить ${e.name} из списка скрытых чатов?`, [
                        {
                            text: 'Нет',
                            type: 'danger'
                        },
                        {
                            text: 'Да',
                            type: 'primary',
                            onclick: ()=>{
                                hiddenChats.splice(hiddenChats.indexOf(e), 1);
                                localStorage.hiddenChats = JSON.stringify(hiddenChats);
                                location.reload();
                            }
                        }
                    ]);
                });

                btd.appendChild(bd);
                tr.appendChild(c);
                tr.appendChild(btd);
                tb.appendChild(tr);
            });

            w.popup('Скрытые чаты', tb, [{text: 'Закрыть', type: 'danger'}], {closeOnClick: true});
        }

        w.adBlockerUI = function(){
            let tb = document.createElement('table');
            tb.style.maxHeight = '300px';
            tb.style.overflow = 'auto';
            adBlockerFilters.forEach((e,i,o)=>{
                let tr = document.createElement('tr');
                let c = document.createElement('td');
                c.className = 'btn-menu-item rp';
                c.innerText = e.name;
                c.title = e.description;
                if(e.only_channels) c.title += '\nФильтр действует только на каналы';
                if(e.chats) c.title += `\nФильтр действует только на следующие ${e.only_channels?'каналы':'чаты'}: ${e.chats.join(', ')}`;

                let betd = document.createElement('td');
                let bed = document.createElement('button');
                bed.className = 'btn rp tgico-check';
                bed.style.padding = '3px';
                bed.style.marginLeft = '180px';
                bed.style.fontSize = '150%';
                if(e.enabled){
                    bed.style.color = 'green';
                    bed.title = 'Отключить фильтр';
                    bed.addEventListener('click', ()=>{
                        o[i].enabled = false;
                        localStorage.adBlockerFilters = JSON.stringify(o);
                        w.adBlockerUI();
                    });
                }else{
                    bed.style.color = 'gray';
                    bed.title = 'Включить фильтр';
                    bed.addEventListener('click', ()=>{
                        o[i].enabled = true;
                        localStorage.adBlockerFilters = JSON.stringify(o);
                        w.adBlockerUI();
                    });
                }

                let btd = document.createElement('td');
                let bd = document.createElement('button');
                bd.className = 'btn danger rp tgico-delete';
                bd.style.padding = '3px';
                bd.style.fontSize = '150%';
                bd.title = 'Удалить фильтр';
                bd.addEventListener('click', ()=>{
                    w.popup('Удалить фильтр', `Вы точно хотите удалить фильтр ${e.name}?`, [
                        {
                            text: 'Нет',
                            type: 'danger'
                        },
                        {
                            text: 'Да',
                            type: 'primary',
                            onclick: ()=>{
                                adBlockerFilters.splice(adBlockerFilters.indexOf(e), 1);
                                localStorage.adBlockerFilters = JSON.stringify(adBlockerFilters);
                                w.adBlockerUI();
                            }
                        }
                    ]);
                });

                betd.appendChild(bed);
                if(e.name != 'default') btd.appendChild(bd);
                tr.appendChild(c);
                tr.appendChild(betd);
                tr.appendChild(btd);
                tb.appendChild(tr);
            });

            w.popup('Фильтры блокировщика рекламы', tb, [
                {text: 'Закрыть', type: 'danger'},
                {text: 'Добавить фильтр', type: 'primary', onclick: addFilter}
            ], {closeOnClick: true});
        }

        w.interfaceConfigUI = function(){
            let d = document.createElement('div');
            d.style.maxHeight = '300px';
            d.style.overflow = 'auto';

            for(let i in interfaceConfig){
                let e = interfaceConfig[i];

                let el;
                if(e.type == 'boolean'){
                    el = document.createElement('button');
                    el.className = 'btn-primary btn-transparent tgico-check rp'+(e.value?' primary':'');
                    el.dataset.checked = 'false';
                    el.innerHTML = `
                        <div class="c-ripple"></div>
                        <span class="i18n" style="color: black;">${e.title}</span>`;
                    if(e.value) el.dataset.checked = 'true';
                    el.addEventListener('click', (ev)=>{
                        let ch = w.eval(el.dataset.checked);
                        console.log(ch);
                        el.dataset.checked = !ch;
                        interfaceConfig[i].value = !ch;
                        localStorage.interfaceConfig = JSON.stringify(interfaceConfig);
                        if(ch){
                            el.className = el.className.replace(' primary', '');
                        }else{
                            el.className += ' primary';
                        }
                    });
                }else{
                    el = document.createElement('button');
                    el.className = 'btn-primary btn-transparent tgico-edit rp';
                    el.innerHTML = `
                        <div class="c-ripple"></div>
                        <span class="i18n">${e.title}</span>`;
                    el.addEventListener('click', ()=>{
                        let inp = document.createElement('input');
                        inp.type = 'text';
                        inp.size = 60;
                        inp.autocomplete = 'off';
                        inp.value = e.value;

                        w.popup(e.title, inp, [
                            {
                                text: 'Отмена',
                                type: 'danger'
                            },
                            {
                                text: 'ОК',
                                type: 'primary',
                                onclick: ()=>{
                                    interfaceConfig[i].value = inp.value;
                                    localStorage.interfaceConfig = JSON.stringify(interfaceConfig);
                                }
                            }
                        ]);
                    });
                }
                d.appendChild(el);
            }

            w.popup('Настройки интерфейса', d, [{text: 'Закрыть', type: 'danger'}, {text: 'Применить', type: 'primary', onclick: ()=>{location.reload()}}]);
        }

        w.scriptsUI = function(){
            let tb = document.createElement('table');
            tb.style.maxHeight = '300px';
            tb.style.overflow = 'auto';
            scriptList.forEach((e,i,o)=>{
                let tr = document.createElement('tr');
                let c = document.createElement('td');
                c.className = 'btn-menu-item rp';
                c.innerText = e.name;
                c.title = e.description;
                c.title += '\nСкрипт работает в следующих чатах: '+e.chats.join(', ')

                let betd = document.createElement('td');
                let bed = document.createElement('button');
                bed.className = 'btn rp tgico-check';
                bed.style.padding = '3px';
                bed.style.marginLeft = '180px';
                bed.style.fontSize = '150%';
                if(e.enabled){
                    bed.style.color = 'green';
                    bed.title = 'Отключить скрипт';
                    bed.addEventListener('click', ()=>{
                        o[i].enabled = false;
                        localStorage.scriptList = JSON.stringify(o);
                        w.scriptsUI();
                    });
                }else{
                    bed.style.color = 'gray';
                    bed.title = 'Включить скрипт';
                    bed.addEventListener('click', ()=>{
                        o[i].enabled = true;
                        localStorage.scriptList = JSON.stringify(o);
                        w.scriptsUI();
                    });
                }

                let btd = document.createElement('td');
                let bd = document.createElement('button');
                bd.className = 'btn danger rp tgico-delete';
                bd.style.padding = '3px';
                bd.style.fontSize = '150%';
                bd.title = 'Удалить скрипт';
                bd.addEventListener('click', ()=>{
                    w.popup('Удалить скрипт', `Вы точно хотите удалить скрипт ${e.name}?`, [
                        {
                            text: 'Нет',
                            type: 'danger'
                        },
                        {
                            text: 'Да',
                            type: 'primary',
                            onclick: ()=>{
                                scriptList.splice(scriptList.indexOf(e), 1);
                                localStorage.scriptList = JSON.stringify(scriptList);
                                w.scriptsUI();
                            }
                        }
                    ]);
                });

                betd.appendChild(bed);
                if(e.name != 'default') btd.appendChild(bd);
                tr.appendChild(c);
                tr.appendChild(betd);
                tr.appendChild(btd);
                tb.appendChild(tr);
            });

            w.popup('Скрипты', tb, [
                {text: 'Закрыть', type: 'danger'},
                {text: 'Добавить скрипт', type: 'primary', onclick: addScript}
            ], {closeOnClick: true});
        }

        w.popup = function(title, elem, buttons, options){
            if(!options) options = {};

            let pop = document.createElement('div');
            pop.className = 'popup active';
            let cont = document.createElement('div');
            cont.className = 'popup-container z-depth-1';
            let header = document.createElement('div');
            header.className = 'popup-header';
            let titled = document.createElement('div');
            titled.className = 'popup-title';
            let titlet = document.createElement('span');
            titlet.className = 'i18n';
            titlet.innerText = title;
            let descr = document.createElement('p');
            descr.className = 'popup-description';
            let descrt = document.createElement('span');
            descrt.className = 'i18n';
            if(typeof elem == 'string'){
                descrt.innerHTML = elem;
            }else{
                descr.appendChild(elem);
            }
            let btns = document.createElement('div');
            btns.className = 'popup-buttons';

            pop.appendChild(cont);
            cont.appendChild(header);
            header.appendChild(titled);
            titled.appendChild(titlet);
            cont.appendChild(descr);
            descr.appendChild(descrt);
            cont.appendChild(btns);

            buttons.forEach((e,i,o)=>{
                let btn = document.createElement('button');
                btn.className = `btn ${e.type||''} rp`;
                btn.innerHTML = `<span class="i18n">${e.text}</span>`;
                btn.addEventListener('click', ()=>{
                    if(e.onclick) e.onclick();
                    document.body.removeChild(pop);
                });
                btns.appendChild(btn);
            });

            if(options.closeOnClick){
                pop.addEventListener('click', ()=>{ try{document.body.removeChild(pop)}catch(e){} });
            }

            document.body.appendChild(pop);
        }

        function adBlocker(){
            let userName = location.hash.replace('#');
            if(!userName) return;
            let msgs = document.querySelector('.bubbles-inner');
            if(!msgs) return;
            msgs.querySelectorAll('div.bubble').forEach((el,i,o)=>{
                if(el.dataset.noAds) return;
                el.dataset.noAds = true;

                let msgText, msgHTML;
                let msg = el.querySelector('div.message');
                let r = getMessageText(msg);
                msgText = r[0];
                msgHTML = r[1];

                if(el.querySelector('.reply-markup')) msgText += el.querySelector('.reply-markup').innerText;

                let deleteMsg = false;
                adBlockerFilters.forEach((e,i,o)=>{
                    if(!e.enabled) return;
                    if(e.chats && (e.chats.indexOf(userName) == -1)) return;
                    if(e.only_channels && !el.className.includes('channel-post')) return;
                    e.filters.forEach((e,i,o)=>{
                        if(!deleteMsg && e.html_contains){
                            e.html_contains.forEach((e)=>{ if(msgHTML.includes(e)) deleteMsg = true });
                        }
                        if(!deleteMsg && e.text_contains){
                            e.text_contains.forEach((e)=>{ if(msgText.includes(e)) deleteMsg = true });
                        }
                        if(!deleteMsg && e.html_matches){
                            deleteMsg = new RegExp(e.html_matches).test(msgHTML);
                        }
                        if(!deleteMsg && e.text_matches){
                            deleteMsg = new RegExp(e.text_matches).test(msgText);
                        }
                        if(!deleteMsg && e.html_selector){
                            deleteMsg = !!msg.querySelector(e.html_selector);
                        }
                    });
                });
                if(deleteMsg){
                    console.log('[Блокировщик рекламы] Рекламное сообщение #'+el.dataset.mid+' удалено.');
                    el.parentNode.removeChild(el);
                }
            });
        }

        function addFilter(){
            let inp = document.createElement('input');
            inp.type = 'url';
            inp.size = 60;
            inp.autocomplete = 'off';
            inp.placeholder = 'Введите URL или код фильтра';

            w.popup('Добавить фильтр', inp, [{text: 'Отмена', type: 'danger'}, {text: 'Добавить', type: 'primary', onclick: ()=>{filterAdd(inp.value)}}]);
        }

        function filterAdd(url){
            if(url.startsWith('{')){
                try{
                    adBlockerFilters.push(JSON.parse(url));
                    localStorage.adBlockerFilters = JSON.stringify(adBlockerFilters);
                    w.popup('', 'Фильтр успешно добавлен.', [{text:'OK', type: 'primary'}]);
                }catch(e){
                    w.popup('Ошибка', 'Некорректный код фильтра', [{text:'OK', type: 'primary'}]);
                }
            }else{
                if(!url || !url.match(/http[s]*:\/\/[a-zA-Z0-9\/\.\-\_]+\.json/)){
                    w.popup('Ошибка', 'Некорректный URL фильтра', [{text:'OK', type: 'primary'}]);
                    return;
                }

                let xhr = new XMLHttpRequest();
                xhr.open('GET', url+(url.includes('?')?'&':'?')+'rand='+new Date().getTime());
                xhr.onload = ()=>{
                    if(xhr.status == 200){
                        try{
                            adBlockerFilters.push(JSON.parse(xhr.response));
                            localStorage.adBlockerFilters = JSON.stringify(adBlockerFilters);
                            w.popup('', 'Фильтр успешно добавлен.', [{text:'OK', type: 'primary'}]);
                        }catch(e){
                            w.popup('Ошибка', 'Некорректный формат фильтра.', [{text:'OK', type: 'primary'}]);
                        }
                    }else{
                        w.popup('Ошибка', `Не удалось скачать фильтр: ${xhr.status} ${xhr.statusText}`, [{text:'OK', type: 'primary'}]);
                    }
                }
                xhr.onerror = ()=>{
                    w.popup('Ошибка', `Не удалось скачать фильтр: ${xhr.status} ${xhr.statusText}`, [{text:'OK', type: 'primary'}]);
                }
                xhr.send();
            }
        }

        function addScript(){
            let inp = document.createElement('input');
            inp.type = 'url';
            inp.size = 60;
            inp.autocomplete = 'off';
            inp.placeholder = 'Введите URL или код скрипта';

            w.popup('Добавить скрипт', inp, [{text: 'Отмена', type: 'danger'}, {text: 'Добавить', type: 'primary', onclick: ()=>{scriptAdd(inp.value)}}]);
        }

        function scriptAdd(url){
            if(url.startsWith('{')){
                try{
                    scriptList.push(JSON.parse(url));
                    localStorage.scriptList = JSON.stringify(scriptList);
                    w.popup('', 'Скрипт успешно установлен.', [{text:'OK', type: 'primary'}]);
                }catch(e){
                    w.popup('Ошибка', 'Некорректный код скрипта.', [{text:'OK', type: 'primary'}]);
                }
            }else{
                if(!url || !url.match(/http[s]*:\/\/[a-zA-Z0-9\/\.\-\_]+\.json/)){
                    w.popup('Ошибка', 'Некорректный URL скрипта.', [{text:'OK', type: 'primary'}]);
                    return;
                }

                let xhr = new XMLHttpRequest();
                xhr.open('GET', url+(url.includes('?')?'&':'?')+'rand='+new Date().getTime());
                xhr.onload = ()=>{
                    if(xhr.status == 200){
                        try{
                            scriptList.push(JSON.parse(xhr.response));
                            localStorage.scriptList = JSON.stringify(scriptList);
                            w.popup('', 'Скрипт успешно установлен.', [{text:'OK', type: 'primary'}]);
                        }catch(e){
                            w.popup('Ошибка', 'Некорректный формат скрипта.', [{text:'OK', type: 'primary'}]);
                        }
                    }else{
                        w.popup('Ошибка', `Не удалось скачать скрипт: ${xhr.status} ${xhr.statusText}`, [{text:'OK', type: 'primary'}]);
                    }
                }
                xhr.onerror = ()=>{
                    w.popup('Ошибка', `Не удалось скачать скрипт: ${xhr.status} ${xhr.statusText}`, [{text:'OK', type: 'primary'}]);
                }
                xhr.send();
            }
        }

        function configureInterface(){
            for(let i in interfaceConfig){
                let e = interfaceConfig[i];
                if(e.value){
                    try{
                        w.eval(e.exec.replaceAll('value', (e.type=='string'?'"':'')+e.value+(e.type=='string'?'"':'')));
                    }catch(ex){}
                }
            }
        }

        function setupBCSH(){
            let c = w.bcsh.commands;
            c['tg.getmsg'] = getLastMessage;
            c['tg.sendmsg'] = (args)=>{ sendMessage(args[0]) }
        }

        function execScripts(){
            if(!document.querySelector('.input-message-input') || !document.querySelector('div.bubble.is-in')) return;
            scriptList.forEach((e,i,o)=>{
                if(e.enabled && e.chats.indexOf(location.hash.replace('#', '')) > -1) w.bcsh.exec(e.code);
            });
        }

        function getMessageText(msg){
            if(!msg) return ['', ''];
            let msgText = '';
            let msgHTML = '';
            msg.childNodes.forEach((e,i,o)=>{
                if(e.className != 'time tgico'){
                    if(e.nodeName == '#text'){
                        msgText += e.data;
                        msgHTML += e.data;
                    }else{
                        msgText += e.innerText;
                        msgHTML += e.outerHTML;
                    }
                }
            });
            return [msgText, msgHTML];
        }

        function getLastMessage(){
            if(document.querySelector('div.bubble.is-in')){
                let m = [];
                document.querySelectorAll('div.bubble').forEach((e,i,o)=>{
                    m.push({b: e, m: e.querySelector('.message')});
                });
                let e = m[m.length-1];
                if(e.b.className.includes('is-in')) return getMessageText(e.m)[0];
            }
        }

        function sendMessage(text){
            let sendi = document.querySelector('.input-message-input');
            let sendb = document.querySelector('.btn-send');
            if(!sendi || !sendb) return;
            sendi.innerText = text;
            sendb.click();
        }

        function downloadChat(){
            let userName = document.querySelector('.chat-info').querySelector('.user-title').innerText;
            let msgs = document.querySelector('.bubbles-inner');
            let text = `Чат с ${userName}\n\n`;
            msgs.querySelectorAll('.bubble').forEach((e,i,o)=>{
                let msg = e.querySelector('.message');
                if(!msg) return;
                let msgText = '';
                msg.childNodes.forEach((e_,i_,o_)=>{
                    if(e_.className != 'time tgico') msgText += (e_.innerText||e_.data);
                });
                text += (e.className.includes('is-out')?'Вы':userName)+':\n'+msgText+'\n\n';
            });

            let a = document.createElement('a');
            a.href = 'data:text/plain;charset=utf-8,'+encodeURIComponent(text);
            a.target = '_blank';
            a.innerText = 'chat log';
            a.download = userName+'.txt';
            a.click();
        }
    }
})();
