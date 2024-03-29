/**
 * Created by PhpStorm.
 * User: Devmc
 * Date: 2021/8/25
 * Time: 2:38
 */

/**
 * LightSwiper
 *
 * 原理：
 *  1. 动画：利用 transform + transition
 *  2. 切换（first向左切换到last，last向右切换到first）：
 *      在列表开头添加设置的最后一张图片，在列表结束添加设置的第一张图片，因此总图片数为 length + 1；
 *      默认显示列表第二张图片，即设置的第一张图片；
 *      在做上述切换时，如first向左切换到last，先切换到列表第一张图片，再关闭动画，切换到列表倒数第二张图片。
 *      以此实现无缝切换，具体看代码效果。
 *
 * @param selector
 * @param options
 * {
 *     images: []               // 图片  [url] or [{url,href}]
 *     interval: 5000           // 图片切换间隔
 *     autoplay: true           // 是否自动播放
 *     duration: 1000           // 动画播放时间
 *     target: '_self'          // 链接打开位置  _self,_blank,_parent,_top
 *     draggable: false         // 图片是否可拖动
 *     leftButtonImage: ''      // 左边按钮的图片
 *     rightButtonImage: ''     // 右边按钮的图片
 *     stopOnMouseover: true    // 当鼠标悬浮在左右按钮、小圆点上时，停止自动播放
 *     showButtons: 'always'    // 切换箭头的显示时机  always,hover,never
 *     showDots: 'always'       // 切换圆点的显示时机  always,hover,never
 * }
 * @constructor
 */
function LightSwiper(selector, options = {}) {
    // 读取、设置参数
    // 选择器
    this.selector = selector || '';

    // 图片
    this.images = [];
    // 如果容器内有<img>，则优先使用此资源
    this._defaultImages = document.querySelectorAll(selector + ' > img');
    if (this._defaultImages.length) {
        this._defaultImages.forEach((item) => {
            this.images.push({
                url: item.src,
                href: item.dataset.href || ''
            });
            // 删除自身
            item.remove();
        });
    }
    // 参数是传的数组
    else if (Array.isArray(options.images) && options.images.length) {
        // 处理子元素为对象
        options.images.forEach((item) => {
            const isObject = typeof item === "object";
            this.images.push({
                url: isObject ? (item.url || '') : item,
                href: isObject ? (item.href || '') : ''
            });
        });
    }

    // 切换间隔
    this.interval = options.interval || 5000;

    // 自动播放
    this.autoplay = options.hasOwnProperty('autoplay') ? options.autoplay : true;

    // 动画时间
    this.duration = options.duration || 1000;

    // 打开位置
    this.target = options.target || '_self';

    // 图片是否可拖动
    this.draggable = options.hasOwnProperty('draggable') ? options.draggable : true;

    // 左边按钮图片
    this.leftButtonImage = options.leftButtonImage || '';

    // 右边按钮图片
    this.rightButtonImage = options.rightButtonImage || '';

    // 切换箭头的显示时机
    this.showButtons = options.showButtons || 'always';

    // 切换圆点的显示时机
    this.showDots = options.showDots || 'always';

    // 当鼠标悬浮在左右按钮、小圆点上时，停止自动播放
    this.stopOnMouseover = options.hasOwnProperty('noSwipeWhenMouseover') ? options.noSwipeWhenMouseover : true;

    // 初始化
    this._init();
}

LightSwiper.prototype = {
    /**
     * 初始化各种参数，创建DOM、监听事件
     *
     * @private
     */
    _init() {
        // 容器
        this._container = document.querySelector(this.selector);
        // 图片展示的宽高设置为容器大小
        this._width = this._container.clientWidth;
        this._height = this._container.clientHeight;

        // 图片的张数
        this._length = this.images.length;
        // 当前播放的位置
        this._index = 0;

        // 计时器
        this._timer = null;
        // 节流函数，是否操作结束
        this._timeout = null;

        // 创建DOM
        this._initDom();

        // 监听事件
        this._a = {
            ea: null
        }
        this.bindEvent();

        // 自动播放
        this._startSlide();
    },
    /**
     * 创建DOM
     *
     * @private
     */
    _initDom() {
        // 设置draggable
        if (!this.draggable) {
            this._container.setAttribute('ondragstart', 'return false');
        }

        // 容器的Class
        // Hover
        if (!this._container.classList.contains('light-swiper')) {
            this._container.classList.add('light-swiper');
        }
        if (this.showDots === 'hover') this._container.classList.add('hover-dots')
        if (this.showButtons === 'hover') this._container.classList.add('hover-buttons')


        // 图片列表
        this._swiper = document.createElement('ul');
        // 图片张数为 length + 2
        this._swiper.style.width = `${this._width * (this._length + 1)}px`;
        // 第一张图片在列表中第二位
        this._swiper.style.left = `-${this._width}px`;
        this._swiper.style.transition = `left ${this.duration}ms ease-in-out`;
        this._container.appendChild(this._swiper);

        // 图片
        let array = this.images;
        // 在列表开头添加设置的最后一张图片，在列表结束添加设置的第一张图片
        if (this._length > 1) {
            array = [this.images[this._length - 1], ...this.images, this.images[0]];
        }
        array.forEach((item, index) => {
            // 图片
            let imgDom = `<img src="${item.url}" alt="">`;
            // 跳转链接、跳转位置
            if (item.href) imgDom = `<a href="${item.href}" target="${this.target}">${imgDom}</a>`;
            this._swiper.innerHTML += `<li style="width: ${this._width}px; left: ${index * this._width}px;">${imgDom}</li>`;
        });

        // dots
        if (this.showDots !== 'never') {
            this._dots = document.createElement('div');
            this._dots.classList.add('dots');
            for (let i = 0; i < this._length; i++) {
                // 默认显示第一张图片
                if (i === 0) this._dots.innerHTML += `<span data-index="${i}" class="active"></span>`
                else this._dots.innerHTML += `<span data-index="${i}"></span>`
            }
            this._container.appendChild(this._dots);
        }

        // leftButton
        if (this.showButtons !== 'never') {
            this._left = document.createElement('button');
            this._left.classList.add('arrow-button');
            this._left.classList.add('arrow-left');
            // 传的图片地址
            if (this.leftButtonImage) this._left.innerHTML = `<img src="${this.leftButtonImage}" alt=""/>`;
            // 默认SVG
            else this._left.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z" fill="#fff"/></svg>`;
            this._container.appendChild(this._left);

            // rightButton
            this._right = document.createElement('button');
            this._right.classList.add('arrow-button');
            this._right.classList.add('arrow-right');
            // 传的图片地址
            if (this.rightButtonImage) this._right.innerHTML = `<img src="${this.rightButtonImage}" alt=""/>`;
            // 默认SVG
            else this._right.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" fill="#fff"/></svg>`;
            this._container.appendChild(this._right);
        }
    },
    /**
     * 绑定事件
     *
     * @private
     */
    bindEvent() {
        // dots
        if (this.showDots !== 'never') {
            this._dots.addEventListener('click', (e) => {
                this._clearSlide();
                const target = e.target;
                this._index = parseInt(target.dataset.index);
                this._swiper.style.transitionProperty = 'left';
                this._swiper.style.left = `-${this._width * (this._index + 1)}px`;
                this._changeDot();
                this._startSlide();
            })
        }

        // left
        if (this.showButtons !== 'never') {
            this._left.addEventListener('click', () => this._throttle(this.prev));

            // right
            this._right.addEventListener('click', () => this._throttle(this.next));
        }

        // 当鼠标悬浮在左右按钮、小圆点上时，停止自动播放
        if (this.stopOnMouseover) {
            [this._dots, this._left, this._right].forEach((item) => {
                if (item) {
                    item.addEventListener('mouseover', this._clearSlide)
                    item.addEventListener('mouseout', this._startSlide)
                }
            });
        }
    },
    /**
     * 切换圆点的 active
     *
     * @private
     */
    _changeDot() {
        if (this.showDots !== 'never') {
            const dots = this._dots.querySelectorAll('span');
            dots.forEach((item, index) => {
                if (index === this._index) item.classList.add('active');
                else item.classList.remove('active');
            });
        }
    },
    /**
     * 开始自动播放
     *
     * @private
     */
    _startSlide() {
        if (this.autoplay && this._timer === null) {
            this._timer = setInterval(this.next.bind(this), this.interval);
        }
    },
    /**
     * 清除自动播放任务
     *
     * @private
     */
    _clearSlide() {
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
    },
    /**
     * 节流函数，避免重复点击按钮
     *
     * @param func
     * @param duration
     */
    _throttle(func, duration = this.duration) {
        if (!this._timeout) {
            func.call(this, arguments);
            this._timeout = setTimeout(() => {
                this._timeout = null
            }, duration);
        }
    },

    /**
     * 切换上一张图片
     */
    prev() {
        // 只有一张图片不执行
        if (this._length === 1) return;

        this._clearSlide();
        this._swiper.style.transitionProperty = 'left';
        // 先向左切换一张
        this._swiper.style.left = `${parseInt(this._swiper.style.left) + this._width}px`;
        // 从第一张向左切换到最后一张
        // 在做切换时，先切换到列表第一张图片，再关闭动画，切换到列表倒数第二张图片，以此实现无缝切换，具体看代码效果
        if (this._index === 0) {
            this._index = this._length - 1;
            setTimeout(() => {
                this._swiper.style.transitionProperty = 'none';
                this._swiper.style.left = `-${this._width * this._length}px`;
            }, this.duration)
        }
        else {
            this._index--;
        }
        this._changeDot();
        this._startSlide();
    },
    /**
     * 切换下一张图片
     */
    next() {
        // 只有一张图片不执行
        if (this._length === 1) return;

        this._clearSlide();
        this._swiper.style.transitionProperty = 'left';
        // 先向右切换一张
        this._swiper.style.left = `${parseInt(this._swiper.style.left) - this._width}px`;
        // 从最后一张向右切换到第一张
        // 在做切换时，先切换到列表最后一张图片，再关闭动画，切换到列表第二张图片，以此实现无缝切换，具体看代码效果
        if (this._index + 1 === this._length) {
            this._index = 0;
            setTimeout(() => {
                this._swiper.style.transitionProperty = 'none';
                this._swiper.style.left = `-${this._width}px`;
            }, this.duration)
        }
        else {
            this._index++;
        }
        this._changeDot();
        this._startSlide();
    }
}
