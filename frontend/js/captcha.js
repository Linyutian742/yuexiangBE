/* captcha.js - 人机验证系统 (ES5, 兼容安卓6) */
/* 支持同一页面多个验证码容器同时工作 */

var CaptchaManager = {
    // Per-container state: {containerId: {session, selectedIndices, sliderValue, sliderTarget}}
    _states: {},
    // Currently active container (for backward compatibility with single-captcha pages)
    containerId: null,

    // Get or create state for a specific container
    _getState: function (containerId) {
        if (!this._states[containerId]) {
            this._states[containerId] = {
                session: null,
                selectedIndices: [],
                sliderValue: 0,
                sliderTarget: 50
            };
        }
        return this._states[containerId];
    },

    // Find container ID by walking up DOM from an element
    _findContainerId: function (el) {
        while (el && el.parentNode) {
            if (el.id && this._states[el.id]) return el.id;
            el = el.parentNode;
        }
        return this.containerId;
    },

    // Scoped element lookup within a specific container
    _el: function (id, containerId) {
        var cid = containerId || this.containerId;
        if (cid) {
            var container = document.getElementById(cid);
            if (container) {
                var el = container.querySelector('#' + id);
                if (el) return el;
            }
        }
        return document.getElementById(id);
    },

    // Load a new captcha into a specific container
    load: function (containerId, onLoaded) {
        var self = this;
        var state = this._getState(containerId);
        state.selectedIndices = [];
        state.sliderValue = 0;
        this.containerId = containerId;
        ajaxGet('/api/captcha', function (resp) {
            if (resp.success) {
                state.session = resp.captcha;
                // Store session_id on container element for reliable retrieval
                var container = document.getElementById(containerId);
                if (container) {
                    container.setAttribute('data-session-id', resp.captcha.session_id);
                }
                self._render(containerId, resp.captcha);
                if (onLoaded) onLoaded(resp.captcha);
            } else {
                showToast('验证码加载失败', 'error');
            }
        });
    },

    // Render captcha based on type
    _render: function (containerId, cap) {
        var container = document.getElementById(containerId);
        if (!container || !cap) return;

        var data = cap.data;
        var html = '';
        var cid = containerId;  // Capture for closures

        if (cap.type === 1) {
            // Math calculation
            html += '<div class="captcha-question">' + data.question + '</div>';
            html += '<input type="text" class="form-input" id="captcha-answer" placeholder="输入计算结果" autocomplete="off">';
        }
        else if (cap.type === 2 || cap.type === 5) {
            // Select items from grid
            html += '<div class="captcha-question">' + data.prompt + '</div>';
            html += '<div class="captcha-grid" id="captcha-grid">';
            for (var i = 0; i < data.grid.length; i++) {
                html += '<div class="captcha-item" onclick="CaptchaManager.toggleItem(' + i + ',\'' + cid + '\')" id="cap-item-' + i + '">' + data.grid[i] + '</div>';
            }
            html += '</div>';
            html += '<input type="hidden" id="captcha-answer" value="">';
        }
        else if (cap.type === 3) {
            // Distorted code captcha
            html += '<div class="captcha-question">请输入下方验证码</div>';
            html += '<div class="captcha-code">' + data.code + '</div>';
            html += '<input type="text" class="form-input" id="captcha-answer" placeholder="输入验证码" autocomplete="off" style="text-transform:uppercase;">';
        }
        else if (cap.type === 4) {
            // Slide puzzle
            this._getState(cid).sliderTarget = data.target || 50;
            html += '<div class="captcha-question">滑动滑块到缺口位置</div>';
            html += '<div class="captcha-slider-wrap" id="captcha-slider">';
            html += '<div class="captcha-slider-gap" id="captcha-slider-gap" style="left:' + (data.target || 50) + '%;"></div>';
            html += '<div class="captcha-slider-track" id="captcha-track"></div>';
            html += '<div class="captcha-slider-hint">向右拖动滑块</div>';
            html += '<div class="captcha-slider-btn" id="captcha-slider-btn" style="left:0;">&gt;&gt;</div>';
            html += '</div>';
            html += '<input type="hidden" id="captcha-answer" value="0">';
        }
        else if (cap.type === 6) {
            // Multiple choice
            html += '<div class="captcha-question">' + data.question + '</div>';
            html += '<div class="captcha-choices">';
            for (var j = 0; j < data.options.length; j++) {
                html += '<button class="captcha-choice-btn" onclick="CaptchaManager.selectChoice(\'' + data.options[j] + '\', this, \'' + cid + '\')" id="cap-choice-' + j + '">' + data.options[j] + '</button>';
            }
            html += '</div>';
            html += '<input type="hidden" id="captcha-answer" value="">';
        }
        else if (cap.type === 7) {
            // Click "I'm not a robot" then select chicken
            html += '<div class="captcha-question">' + data.prompt + '</div>';
            html += '<div id="captcha-step1">';
            html += '<button class="btn btn-secondary" onclick="CaptchaManager.step2(\'' + cid + '\')" style="width:100%;">我不是机器人</button>';
            html += '</div>';
            html += '<div id="captcha-step2" class="hidden">';
            html += '<div class="captcha-choices">';
            for (var k = 0; k < data.options.length; k++) {
                html += '<button class="captcha-choice-btn" onclick="CaptchaManager.selectChoice(\'' + data.options[k] + '\', this, \'' + cid + '\')" id="cap-choice2-' + k + '">' + data.options[k] + '</button>';
            }
            html += '</div>';
            html += '</div>';
            html += '<input type="hidden" id="captcha-answer" value="">';
        }

        html += '<div class="captcha-refresh" onclick="CaptchaManager.load(\'' + cid + '\')">换一个验证码</div>';

        container.innerHTML = html;

        // Initialize slider if type 4
        if (cap.type === 4) {
            var self2 = this;
            setTimeout(function () { self2._initSlider(cid); }, 50);
        }
    },

    // Keep public render for backward compatibility
    render: function (containerId) {
        var state = this._getState(containerId);
        this._render(containerId, state.session);
    },

    // Toggle grid item selection (scoped to container)
    toggleItem: function (index, containerId) {
        var cid = containerId || this.containerId;
        var state = this._getState(cid);
        var item = this._el('cap-item-' + index, cid);
        if (!item) return;
        var pos = state.selectedIndices.indexOf(index);
        if (pos >= 0) {
            state.selectedIndices.splice(pos, 1);
            item.className = 'captcha-item';
        } else {
            state.selectedIndices.push(index);
            item.className = 'captcha-item selected';
        }
        // Update hidden answer
        var ans = this._el('captcha-answer', cid);
        if (ans) {
            state.selectedIndices.sort(function (a, b) { return a - b; });
            ans.value = state.selectedIndices.join(',');
        }
    },

    // Select a choice for types 6 and 7 (scoped to container)
    selectChoice: function (choice, btn, containerId) {
        var cid = containerId || this._findContainerId(btn);
        var ans = this._el('captcha-answer', cid);
        if (ans) ans.value = choice;
        // Visual feedback - scoped to current captcha container
        var container = cid ? document.getElementById(cid) : null;
        var btns = container ? container.querySelectorAll('.captcha-choice-btn') : document.querySelectorAll('.captcha-choice-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].style.background = '#0f0f1a';
            btns[i].style.color = '#e2e8f0';
            btns[i].setAttribute('data-selected', '0');
        }
        if (btn) {
            btn.style.background = '#a855f7';
            btn.style.color = '#fff';
            btn.setAttribute('data-selected', '1');
        }
    },

    // Step 2 for type 7 (scoped to container)
    step2: function (containerId) {
        var cid = containerId || this.containerId;
        var s1 = this._el('captcha-step1', cid);
        var s2 = this._el('captcha-step2', cid);
        if (s1) s1.className = 'hidden';
        if (s2) s2.className = '';
    },

    // Initialize slider for type 4 (scoped to container)
    _initSlider: function (containerId, retryCount) {
        var self = this;
        var cid = containerId || this.containerId;
        var state = this._getState(cid);
        retryCount = retryCount || 0;
        var btn = this._el('captcha-slider-btn', cid);
        var slider = this._el('captcha-slider', cid);
        var track = this._el('captcha-track', cid);
        var gap = this._el('captcha-slider-gap', cid);
        var hint = this._el('captcha-slider-hint', cid);
        var ans = this._el('captcha-answer', cid);
        if (!btn || !slider) return;

        // Guard: if slider or button not laid out yet, retry (max 10 times = 1s)
        if ((slider.offsetWidth === 0 || btn.offsetWidth === 0) && retryCount < 10) {
            var self2 = self;
            setTimeout(function () { self2._initSlider(cid, retryCount + 1); }, 100);
            return;
        }

        var isDragging = false;
        var startX = 0;
        var startLeft = 0;
        // Trackable range = slider width minus button width
        var trackRange = slider.offsetWidth - btn.offsetWidth;
        if (trackRange < 1) trackRange = 1;

        // Position gap at target percentage of trackable range
        var target = state.sliderTarget || 50;
        if (gap && trackRange > 0) {
            var gapCenter = Math.round((target / 100) * trackRange);
            gap.style.left = gapCenter + 'px';
        }

        function getClientX(e) {
            if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
            if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
            return e.clientX;
        }

        function setPosition(px) {
            if (px < 0) px = 0;
            if (px > trackRange) px = trackRange;
            btn.style.left = px + 'px';
            if (track) track.style.width = px + 'px';
            // Answer = percentage of BUTTON CENTER within trackable range
            // Users naturally align button center to gap center
            var btnCenter = px + btn.offsetWidth / 2;
            var pct = Math.round((btnCenter / trackRange) * 100);
            state.sliderValue = pct;
            if (ans) ans.value = pct;
        }

        function onStart(e) {
            isDragging = true;
            startX = getClientX(e);
            startLeft = parseInt(btn.style.left) || 0;
            if (hint) hint.style.display = 'none';
        }

        function onMove(e) {
            if (!isDragging) return;
            var diff = getClientX(e) - startX;
            setPosition(startLeft + diff);
        }

        function onEnd() {
            isDragging = false;
        }

        // Mouse events
        btn.onmousedown = function (e) {
            e = e || window.event;
            onStart(e);
            document.onmousemove = function (e2) {
                e2 = e2 || window.event;
                onMove(e2);
            };
            document.onmouseup = function () {
                onEnd();
                document.onmousemove = null;
                document.onmouseup = null;
            };
            return false;
        };

        // Touch events (for mobile)
        btn.ontouchstart = function (e) {
            onStart(e);
        };
        btn.ontouchmove = function (e) {
            onMove(e);
            e.preventDefault();
        };
        btn.ontouchend = function (e) {
            onEnd();
        };
    },

    // Keep public initSlider for backward compatibility
    initSlider: function (retryCount) {
        this._initSlider(this.containerId, retryCount);
    },

    // Get the current answer from a specific container
    getAnswerFor: function (containerId) {
        var ans = this._el('captcha-answer', containerId);
        return ans ? ans.value : '';
    },

    // Get session_id from a specific container (reads from DOM data attribute)
    getSessionIdFor: function (containerId) {
        var container = document.getElementById(containerId);
        if (container) {
            var sid = container.getAttribute('data-session-id');
            if (sid) return sid;
        }
        // Fallback to state
        var state = this._states[containerId];
        return state && state.session ? state.session.session_id : '';
    },

    // Get the current answer (uses current container - for single-captcha pages)
    getAnswer: function () {
        return this.getAnswerFor(this.containerId);
    },

    // Get session_id (uses current container - for single-captcha pages)
    getSessionId: function () {
        return this.getSessionIdFor(this.containerId);
    },

    // Verify captcha (standalone, not used in form submission)
    verify: function (callback) {
        var self = this;
        ajaxPost('/api/captcha/verify', {
            session_id: self.getSessionId(),
            answer: self.getAnswer()
        }, function (resp) {
            callback(resp.success);
        });
    }
};
