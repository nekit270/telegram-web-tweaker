// ==UserScript==
// @name         Telegram Web Tweaker
// @namespace    http://nekit270.42web.io
// @version      1.0
// @description  Добавляет новые функции в Telegram
// @author       nekit270
// @match        http://web.telegram.org/k/*
// @match        https://web.telegram.org/k/*
// @icon         https://web.telegram.org/favicon.ico
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    let w = (window.unsafeWindow)?(window.unsafeWindow):(window); if(w.self != w.top) return;

    const VERSION = '1.0';
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
            startTweaker();
        }else{
            setTimeout(checkChats, 200);
        }
    }, 200);

    function startTweaker(){
        console.log('Telegram Web Tweaker '+VERSION);
        GM.registerMenuCommand('Настройки', ()=>{w.optionsUI()});

        let chatList = document.querySelector('ul.chatlist');
        let pinBtn = null;
        if(!localStorage.pinnedChats) localStorage.pinnedChats = '[]';
        let pinnedChats = JSON.parse(localStorage.pinnedChats || '[]');
        if(!localStorage.adBlockerFilters){
            localStorage.adBlockerFilters = `
            [
                {
                    "name": "default",
                    "description": "Стандартный фильтр. Удаляет сообщения со ссылками вида t.me/username и @username.",
                    "only_channels": true,
                    "enabled": true,
                    "filters": [
                        {
                            "text_contains": ["t.me/", "@"],
                            "html_contains": ["onclick=\\"joinchat(this)\\""]
                        }
                    ]
                }
            ]`;
        }
        let adBlockerFilters = JSON.parse(localStorage.adBlockerFilters);

        let p = location.search.replace('?', '').split('&');
        p.forEach((e,i,o)=>{
            e = e.split('=');
            let name = e[0], value = decodeURIComponent(e[1]);
            switch(name){
                case 'tw_install_filter': {
                    filterAdd(value);
                    break;
                }
            }
        });

        setInterval(setPinnedState, 400);
        setInterval(()=>{
            if(chatList.firstChild?.dataset.twPinned != 'true') pinChats(1);
            document.querySelectorAll('a.chatlist-chat').forEach((e,i,o)=>{e.oncontextmenu = ()=>{setTimeout(updatePinBtn, 210)}});
            hideChats();
            adBlocker();
        }, 300);

        if(!localStorage.hiddenChats) localStorage.hiddenChats = '[]';
        let hiddenChats = JSON.parse(localStorage.hiddenChats || '[]');

        setTimeout(function checkDialogMenu(){
            if(document.querySelector('div.btn-menu.bottom-left')){
                addElemsToDialogMenu();
            }else{
                setTimeout(checkDialogMenu, 200);
            }
        }, 200);
        setTimeout(function checkChatMenu(){
            if(document.querySelector('div.btn-menu.contextmenu')){
                addElemsToChatMenu();
            }else{
                setTimeout(checkChatMenu, 200);
            }
        }, 200);
        setTimeout(function checkOptionsMenu(){
            if(document.querySelector('div.btn-menu.bottom-right.has-footer')){
                addElemsToOptionsMenu();
            }else{
                setTimeout(checkOptionsMenu, 200);
            }
        }, 200);

        function addElemsToDialogMenu(){
            return;
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
            if(!selectedChat || !pinBtn){
                console.log('ОШИБКА', selectedChat, pinBtn);
                return;
            }
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
            console.log('Добавление элементов в контекстное меню чата...');
            let chatMenu = document.querySelector('div.btn-menu.contextmenu');

            let hide = document.createElement('div');
            hide.className = 'btn-menu-item rp-overflow tgico-stop danger';
            hide.innerText = 'Скрыть чат';
            hide.addEventListener('click', ()=>{hideChat(document.querySelector('a.chatlist-chat.menu-open'))});
            chatMenu.appendChild(hide);

            pinBtn = document.createElement('div');
            pinBtn.className = 'btn-menu-item rp-overflow tgico-pin';
            pinBtn.innerText = 'TW-Закрепить';
            chatMenu.appendChild(pinBtn);

            let gid = document.createElement('div');
            gid.className = 'btn-menu-item rp-overflow tgico-info';
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
                <div class="btn-menu-item" style="font-size: 100%" onclick="window.hiddenChatsUI()"><span class="i18n">Скрытые чаты</span></div>
                <div class="btn-menu-item" style="font-size: 100%" onclick="window.adBlockerUI()"><span class="i18n">Блокировщик рекламы</span></div>
            `, [{text: 'Закрыть', type: 'danger'}], {closeOnClick: true});
        }

        w.hiddenChatsUI = function(){
            let tb = document.createElement('table');
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
                            text: 'Да',
                            type: 'primary',
                            onclick: ()=>{
                                hiddenChats.splice(hiddenChats.indexOf(e), 1);
                                localStorage.hiddenChats = JSON.stringify(hiddenChats);
                                location.reload();
                            }
                        },
                        {
                            text: 'Нет',
                            type: 'danger'
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
            adBlockerFilters.forEach((e,i,o)=>{
                let tr = document.createElement('tr');
                let c = document.createElement('td');
                c.className = 'btn-menu-item rp';
                c.innerText = e.name;
                c.title = e.description;
                if(e.only_channels) c.title += '\nФильтр действует только на каналы';
                if(e.chat_names) c.title += `\nФильтр действует только на следующие ${e.only_channels?'каналы':'чаты'}: ${e.chat_names.join(', ')}`;

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
                descr.innerHTML = elem;
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
            let userName = document.querySelector('.chat-info')?.querySelector('.user-title')?.innerText;
            if(!userName) return;
            let msgs = document.querySelector('.bubbles-inner');
            if(!msgs) return;
            msgs.querySelectorAll('div.bubble').forEach((el,i,o)=>{
                if(el.dataset.noAds) return;
                el.dataset.noAds = true;

                let msg = el.querySelector('div.message');
                if(!msg) return;
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

                let deleteMsg = false;
                adBlockerFilters.forEach((e,i,o)=>{
                    if(!e.enabled) return;
                    if(e.chat_names && (e.chat_names.indexOf(userName) == -1)) return;
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

            w.popup('Добавить фильтр', inp, [{text: 'Отмена', type: 'danger'}, {text: 'Добавить', type: 'primary', onclick: filterAdd}]);

            filterAdd(inp.value);
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
