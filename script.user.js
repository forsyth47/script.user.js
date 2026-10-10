// ==UserScript==
// @name         YouTube Move & Remove Buttons for Watch Later (Fast & Dual Buttons)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Move or remove videos from Watch Later playlist via UI simulation (fast, stable, dual buttons, spinners, popup notifications)
// @author       Zero
// @match        *://*.youtube.com/*
// @grant        GM_addStyle
// @run-at       document-end
// Updated on 7/4/2025
// ==/UserScript==

(function () {
    'use strict';

    const targetPlaylistName = 'Watch Later - ∆';
    const popupQueue = [];

    GM_addStyle(`
        .move-playlist-btn, .remove-playlist-btn {
            border: none;
            border-radius: 18px;
            color: white;
            padding: 0 16px;
            height: 36px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .move-playlist-btn {
            background: #0f9d58;
        }
        .move-playlist-btn:hover {
            background: #0c7c45;
        }
        .remove-playlist-btn {
            background: #d93025;
        }
        .remove-playlist-btn:hover {
            background: #a8241b;
        }
        .spinner {
            border: 2px solid #f3f3f3;
            border-top: 2px solid white;
            border-radius: 50%;
            width: 14px;
            height: 14px;
            animation: spin 0.8s linear infinite;
            display: none;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .yt-popup {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #202020;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            margin-top: 8px;
            z-index: 9999;
            opacity: 0.95;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            font-size: 16px;
            font-weight: 500;
            transition: transform 0.3s ease, opacity 0.3s ease;
            pointer-events: none;
        }
    `);

    function getThreeDotsButton() {
        const menuContainer = document.querySelector('#menu ytd-menu-renderer');
        if (!menuContainer) return null;

        const buttons = menuContainer.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (btn.getAttribute('aria-label') && btn.getAttribute('aria-label').toLowerCase().includes('share')) {
                if (buttons[i + 1]) return buttons[i + 1]; // Three-dots button is usually right after share button
            }
        }
        return null;
    }

    function showPopup(message) {
        const popup = document.createElement('div');
        popup.className = 'yt-popup';
        popup.textContent = message;

        const offset = popupQueue.length * 70;
        popup.style.transform = `translateY(-${offset}px)`;

        document.body.appendChild(popup);
        popupQueue.push(popup);

        setTimeout(() => {
            popup.style.opacity = '0';
            setTimeout(() => {
                popup.remove();
                popupQueue.shift();
            }, 300);
        }, 3000);
    }

    function waitForElement(selector, callback, maxTries = 20, interval = 300) {
        let tries = 0;

        function check() {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
                return;
            }

            tries++;
            if (tries < maxTries) {
                setTimeout(check, interval);
            }
        }

        check();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function createButton({ text, className, handler }) {
        const button = document.createElement('button');
        button.className = className;

        const buttonText = document.createElement('span');
        buttonText.textContent = text;

        const spinner = document.createElement('div');
        spinner.className = 'spinner';

        button.appendChild(buttonText);
        button.appendChild(spinner);

        button.addEventListener('click', async () => {
            spinner.style.display = 'inline-block';
            button.disabled = true;

            await handler();

            spinner.style.display = 'none';
            button.disabled = false;
        });

        return button;
    }

    async function openSavePopup() {
        const menuButton = getThreeDotsButton();
        if (!menuButton) {
            showPopup('Menu button not found.');
            return false;
        }
        menuButton.click();
        await sleep(200);

        let menuItems = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer tp-yt-paper-item'));
        const saveItem = menuItems.find(item => item.innerText.trim().toLowerCase() === 'save');
        if (!saveItem) {
            showPopup('Save button not found.');
            document.body.click();
            return false;
        }
        saveItem.click();
        await sleep(200);
        return true;
    }

    async function handleMove() {
        const popupSelector = 'ytd-add-to-playlist-renderer';
        if (!await openSavePopup()) return;

        waitForElement(popupSelector, async (popup) => {
            const playlistItems = Array.from(popup.querySelectorAll('ytd-playlist-add-to-option-renderer'));

            // Uncheck Watch Later
            const watchLaterItem = playlistItems.find(item => {
                const label = item.querySelector('#label');
                return label && label.textContent.trim() === 'Watch Later';
            });

            if (watchLaterItem) {
                const checkbox = watchLaterItem.querySelector('tp-yt-paper-checkbox');
                if (checkbox && checkbox.getAttribute('aria-checked') === 'true') {
                    checkbox.click();
                    showPopup('Removed from Watch Later');
                    await sleep(200);
                }
            }

            // Check target playlist
            const targetPlaylistItem = playlistItems.find(item => {
                const label = item.querySelector('#label');
                return label && label.textContent.trim() === targetPlaylistName;
            });

            if (targetPlaylistItem) {
                const checkbox = targetPlaylistItem.querySelector('tp-yt-paper-checkbox');
                if (checkbox && checkbox.getAttribute('aria-checked') === 'false') {
                    checkbox.click();
                    showPopup(`Added to ${targetPlaylistName}`);
                    await sleep(200);
                } else if (checkbox && checkbox.getAttribute('aria-checked') === 'true') {
                    showPopup('Target playlist already added.');
                    await sleep(200);
                }
            } else {
                showPopup('Target playlist not found.');
            }

            const closeButton = popup.querySelector('#close-button button');
            if (closeButton) {
                closeButton.click();
            } else {
                document.body.click();
            }
        });
    }

    async function handleRemove() {
        const popupSelector = 'ytd-add-to-playlist-renderer';
        if (!await openSavePopup()) return;

        waitForElement(popupSelector, async (popup) => {
            const playlistItems = Array.from(popup.querySelectorAll('ytd-playlist-add-to-option-renderer'));

            // Uncheck Watch Later
            const watchLaterItem = playlistItems.find(item => {
                const label = item.querySelector('#label');
                return label && label.textContent.trim() === 'Watch Later';
            });

            if (watchLaterItem) {
                const checkbox = watchLaterItem.querySelector('tp-yt-paper-checkbox');
                if (checkbox && checkbox.getAttribute('aria-checked') === 'true') {
                    checkbox.click();
                    showPopup('Removed from Watch Later');
                    await sleep(200);
                } else {
                    showPopup('Watch Later not found or already unchecked.');
                    await sleep(200);
                }
            } else {
                showPopup('Watch Later not found.');
            }

            const closeButton = popup.querySelector('#close-button button');
            if (closeButton) {
                closeButton.click();
            } else {
                document.body.click();
            }
        });
    }

    function tryAddButtons() {
        if (!window.location.href.includes('list=WL')) return;

        waitForElement('#subscribe-button button', (subscribeButton) => {
            if (!document.querySelector('.move-playlist-btn')) {
                const moveButton = createButton({
                    text: 'Move to ∆ Playlist',
                    className: 'move-playlist-btn',
                    handler: handleMove
                });

                const removeButton = createButton({
                    text: 'Remove',
                    className: 'remove-playlist-btn',
                    handler: handleRemove
                });

                const container = subscribeButton.closest('#subscribe-button');
                if (container) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'youhou-buttons-wrapper';
                    wrapper.style.display = 'flex';
                    wrapper.style.alignItems = 'center';
                    wrapper.style.gap = '8px';

                    container.parentNode.insertBefore(wrapper, container);
                    wrapper.appendChild(container);

                    wrapper.appendChild(moveButton);
                    wrapper.appendChild(removeButton);
                }
            }
        });
    }

    document.addEventListener('yt-navigate-finish', function () {
        setTimeout(tryAddButtons, 300);
    });

    if (window.location.pathname.includes('/watch')) {
        setTimeout(tryAddButtons, 300);
    }
})();
