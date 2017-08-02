(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define('MCanvas', factory) :
	(global.MCanvas = factory());
}(this, (function () { 'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _ = {
    extend: function extend(obj1, obj2) {
        for (var k in obj2) {
            if (obj2.hasOwnProperty(k)) {
                if (_typeof(obj2[k]) == 'object') {
                    if (_typeof(obj1[k]) !== 'object' || obj1[k] === null) {
                        obj1[k] = {};
                    }
                    this.extend(obj1[k], obj2[k]);
                } else {
                    obj1[k] = obj2[k];
                }
            }
        }
        return obj1;
    },
    loadImage: function loadImage(image, loaded, error) {
        var img = new Image();
        if (image.indexOf('http') == 0) {
            img.crossOrigin = '*';
        }
        img.onload = function () {
            loaded(img);
        };
        img.onerror = function () {
            error('img load error');
        };
        img.src = image;
    },
    isArr: function isArr(arr) {
        return Object.prototype.toString.call(arr) === '[object Array]';
    },
    getImage: function getImage(image, cbk) {
        if (typeof image == 'string') {
            this.loadImage(image, function (img) {
                cbk(img);
            }, function (err) {
                console.log(err);
            });
        } else if ((typeof image === 'undefined' ? 'undefined' : _typeof(image)) == 'object') {
            cbk(image);
        } else {
            console.log('add image error');
            return;
        }
    },
    forin: function forin(obj, cbk) {
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                cbk(k, obj[k]);
            }
        }
    }
};

function MCanvas(cwidth, cheight) {

    // 兼容不使用 new 的方式；
    if (!(this instanceof MCanvas)) return new MCanvas(cwidth, cheight);

    // 配置canvas初始大小；
    // cwidth：画布宽度，Number,选填，默认为 500;
    // cheight: 画布高度，Number，选填，默认与宽度一致；
    this.ops = {
        width: cwidth || 500,
        height: cheight || cwidth
    };
    // 全局画布；
    this.canvas = null;
    this.ctx = null;

    // 绘制函数队列；
    this.queue = [];
    // 最后执行的函数；
    this.end = null;

    // 文字绘制数据；
    this.textData = {};

    // 背景图数据;
    this.bgConfig = null;

    // 初始化创建画布；
    this._init();
}

MCanvas.prototype._init = function () {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.ops.width;
    this.canvas.height = this.ops.height;
    this.ctx = this.canvas.getContext('2d');
};

// --------------------------------------------------------
// 绘制背景部分；
// --------------------------------------------------------

MCanvas.prototype.background = function (bg) {
    var _this = this;

    if (!bg && this.bgConfig) bg = this.bgConfig;
    this.bgConfig = bg;
    this.queue.push(function () {
        if (bg.color) {
            _this.ctx.fillStyle = bg.color;
            _this.ctx.fillRect(0, 0, _this.canvas.width, _this.canvas.height);
        }
        if (bg.image) {
            _.getImage(bg.image, function (img) {
                _this._background(img, bg);
            });
        }
    });
    return this;
};

MCanvas.prototype._background = function (img, bg) {
    // 图片与canvas的长宽比；
    var iRatio = img.width / img.height;
    var cRatio = this.canvas.width / this.canvas.height;
    // 背景绘制参数；
    var sx = void 0,
        sy = void 0,
        swidth = void 0,
        sheight = void 0,
        dx = void 0,
        dy = void 0,
        dwidth = void 0,
        dheight = void 0;
    switch (bg.type) {
        // 裁剪模式，固定canvas大小，原图铺满，超出的部分裁剪；
        case 'crop':
            sx = bg.left || 0;
            sy = bg.top || 0;
            if (iRatio > cRatio) {
                swidth = img.height * cRatio;
                sheight = img.height;
            } else {
                swidth = img.width;
                sheight = swidth / cRatio;
            }
            dy = dx = 0;
            dheight = this.canvas.height;
            dwidth = this.canvas.width;
            break;
        // 包含模式，固定canvas大小，包含背景图；
        case 'contain':
            sy = sx = 0;
            swidth = img.width;
            sheight = img.height;
            if (iRatio > cRatio) {
                dwidth = this.canvas.width;
                dheight = dwidth / iRatio;
                dx = bg.left || 0;
                dy = bg.top || bg.top == 0 ? bg.top : (this.canvas.height - dheight) / 2;
            } else {
                dheight = this.canvas.height;
                dwidth = dheight * iRatio;
                dy = bg.top || 0;
                dx = bg.left || bg.left == 0 ? bg.left : (this.canvas.width - dwidth) / 2;
            }
            break;
        // 原图模式：canvas与原图大小一致，忽略初始化 传入的宽高参数；
        // 同时，background 传入的 left/top 均被忽略；
        case 'origin':
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            sx = sy = 0;
            swidth = img.width;
            sheight = img.height;
            dx = dy = 0;
            dwidth = this.canvas.width;
            dheight = this.canvas.height;
            break;
        default:
            console.err('background type error!');
    }
    this.ctx.drawImage(img, sx, sy, swidth, sheight, dx, dy, dwidth, dheight);
    this._next();
};
// --------------------------------------------------------
// 绘制图层部分；
// --------------------------------------------------------

// 绘制水印；基于 add 函数封装；
MCanvas.prototype.watermark = function () {
    var image = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var ops = arguments[1];

    if (!image) {
        console.log('there is not image of watermark');
        return;
    }
    // 参数默认值；
    var _ops$width = ops.width,
        width = _ops$width === undefined ? '40%' : _ops$width,
        _ops$pos = ops.pos,
        pos = _ops$pos === undefined ? 'rightbottom' : _ops$pos,
        _ops$margin = ops.margin,
        margin = _ops$margin === undefined ? 20 : _ops$margin;

    var position = {
        x: 0,
        y: 0,
        scale: 1,
        rotate: 0
    };
    switch (pos) {
        case 'leftTop':
            position.x = 'left:' + margin;
            position.y = 'top:' + margin;
            break;
        case 'leftBottom':
            position.x = 'left:' + margin;
            position.y = 'bottom:' + margin;
            break;
        case 'rightTop':
            position.x = 'right:' + margin;
            position.y = 'top:' + margin;
            break;
        case 'rightBottom':
            position.x = 'right:' + margin;
            position.y = 'bottom:' + margin;
            break;
        default:
    }
    this.add(image, {
        width: width,
        pos: position
    });
    return this;
};

// 通用绘制图层函数；
// 使用方式：
// 多张图: add([{image:'',options:{}},{image:'',options:{}}]);
// 单张图: add(image,options);
MCanvas.prototype.add = function () {
    var _this2 = this;

    var image = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var options = arguments[1];

    // 默认参数；
    var def = {
        width: '100%',
        crop: {
            x: 0,
            y: 0,
            width: '100%',
            height: '100%'
        },
        pos: {
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0
        }
    };

    if (!_.isArr(image)) image = [{ image: image, options: options }];

    image.forEach(function (v) {
        // 将封装好的 add函数 推入队列中待执行；
        // 参数经过 _handleOps 加工；
        _this2.queue.push(function () {
            _.getImage(v.image, function (img) {
                _this2._add(img, _this2._handleOps(_.extend(def, v.options), img));
            });
        });
    });

    return this;
};

MCanvas.prototype._add = function (img, ops) {
    var ratio = img.width / img.height;
    // 画布canvas参数；
    var cdx = void 0,
        cdy = void 0,
        cdw = void 0,
        cdh = void 0;
    // 素材canvas参数；
    var _ops$crop = ops.crop,
        lsx = _ops$crop.x,
        lsy = _ops$crop.y,
        lsw = _ops$crop.width,
        lsh = _ops$crop.height;

    var ldx = void 0,
        ldy = void 0,
        ldw = void 0,
        ldh = void 0;
    //  素材的真实宽高，用于剔除避免裁剪所添加的空白区域；
    var rw = void 0,
        rh = void 0,
        rspaceX = void 0,
        rspaceY = void 0;

    // 素材canvas的绘制;
    var lcvs = document.createElement('canvas');
    var lctx = lcvs.getContext('2d');

    // 取最长边为边长，正方形,避免旋转的时候被裁剪；
    lcvs.height = lcvs.width = ratio > 1 ? img.width : img.height;

    // 从素材canvas的中心点开始绘制；
    ldx = -img.width / 2;
    ldy = -img.height / 2;
    ldw = img.width;
    ldh = img.height;

    lctx.translate(lcvs.width / 2, lcvs.height / 2);
    lctx.rotate(ops.pos.rotate);
    lctx.drawImage(img, lsx, lsy, lsw, lsh, ldx, ldy, ldw, ldh);

    // lcvs.style = 'width:300px';
    // document.querySelector('body').appendChild(lcvs);

    // 获取素材最终的宽高;
    // 由于前面的素材canvas已经绘制成正方形，所以 w = h;
    cdh = cdw = ops.width;

    // 计算绘制成正方形造成的空白区域；
    if (ratio > 1) {
        rh = cdw / ratio;
        rw = 0;
        rspaceX = 0;
        rspaceY = (cdh - rh) / 2;
    } else {
        rw = cdh * ratio;
        rh = 0;
        rspaceX = (cdw - rw) / 2;
        rspaceY = 0;
    }

    // 获取素材的位置；
    //    配置的位置 - 缩放的影响 - 绘制成正方形的影响；
    cdx = ops.pos.x + cdw * (1 - ops.pos.scale) / 2 - rspaceX;
    cdy = ops.pos.y + cdh * (1 - ops.pos.scale) / 2 - rspaceY;

    // 计算配置的缩放值；
    cdh = cdw *= ops.pos.scale;

    this.ctx.drawImage(lcvs, cdx, cdy, cdw, cdh);
    this._next();
};
// 参数加工函数；
MCanvas.prototype._handleOps = function (ops, img) {

    var cw = this.canvas.width,
        ch = this.canvas.height,
        iw = img.width,
        ih = img.height;

    // 图片宽高比；
    var ratio = iw / ih;

    // 根据参数计算后的绘制宽度；
    var width = this._get(cw, iw, ops.width, 'pos');

    // 裁剪的最大宽高；
    var maxLsw = void 0,
        maxLsh = void 0;

    // 裁剪参数；
    var _ops$crop2 = ops.crop,
        cropx = _ops$crop2.x,
        cropy = _ops$crop2.y,
        cropw = _ops$crop2.width,
        croph = _ops$crop2.height;

    var crop = {
        x: this._get(cw, iw, cropx, 'crop'),
        y: this._get(ch, ih, cropy, 'crop'),
        width: this._get(cw, iw, cropw, 'crop'),
        height: this._get(ch, ih, croph, 'crop')
    };
    // 最大值判定；
    if (crop.x > iw) crop.x = iw;
    if (crop.y > ih) crop.y = ih;
    maxLsw = img.width - crop.x;
    maxLsh = img.height - crop.y;
    if (crop.width > maxLsw) crop.width = maxLsw;
    if (crop.height > maxLsh) crop.height = maxLsh;

    // 位置参数；
    var _ops$pos2 = ops.pos,
        px = _ops$pos2.x,
        py = _ops$pos2.y,
        pr = _ops$pos2.rotate,
        ps = _ops$pos2.scale;

    var pos = {
        x: this._get(cw, width, px, 'pos'),
        y: this._get(ch, width / ratio, py, 'pos'),
        scale: ps,
        rotate: parseFloat(pr) * Math.PI / 180
    };
    return { width: width, crop: crop, pos: pos };
};

// --------------------------------------------------------
// 绘制文字部分；
// --------------------------------------------------------
MCanvas.prototype.text = function () {
    var _this3 = this;

    var context = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var ops = arguments[1];

    // 默认字体；
    var fontFamily = 'helvetica neue,hiragino sans gb,Microsoft YaHei,arial,tahoma,sans-serif';
    // 默认的字体大小;
    var size = this.canvas.width / 20;

    this.queue.push(function () {
        var option = {
            width: 300,
            align: 'left',
            smallStyle: {
                font: size * 0.8 + 'px ' + fontFamily,
                color: '#000',
                lineheight: size * 0.9
            },
            normalStyle: {
                font: size + 'px ' + fontFamily,
                color: '#000',
                lineheight: size * 1.1
            },
            largeStyle: {
                font: size * 1.3 + 'px ' + fontFamily,
                color: '#000',
                lineheight: size * 1.4
            },
            pos: {
                x: 0,
                y: 0
            }
        };
        option = _.extend(option, ops);

        // 解析字符串模板后，调用字体绘制函数；
        _this3._text(_this3._parse(context), option);
        _this3._next();
    });
    return this;
};
// 字符串模板解析函数
// 解析 <s></s> <b></b>
MCanvas.prototype._parse = function (context) {
    var arr = context.split(/<s>|<b>/);
    var result = [];
    for (var i = 0; i < arr.length; i++) {
        var value = arr[i];
        if (/<\/s>|<\/b>/.test(value)) {
            var splitTag = /<\/s>/.test(value) ? '</s>' : '</b>',
                type = /<\/s>/.test(value) ? 'small' : 'large';
            var tmp = arr[i].split(splitTag);
            result.push({
                type: type,
                text: tmp[0]
            });
            tmp[1] && result.push({
                type: 'normal',
                text: tmp[1]
            });
            continue;
        }
        arr[i] && result.push({
            text: arr[i],
            type: 'normal'
        });
    }
    return result;
};
MCanvas.prototype._text = function (textArr, option) {
    var _this4 = this;

    // 处理宽度参数；
    option.width = this._get(this.canvas.width, 0, option.width, 'pos');

    var style = void 0,
        line = 1,
        length = 0,
        lineheight = getLineHeight(textArr, option),
        x = this._get(this.canvas.width, option.width, option.pos.x, 'pos'),
        y = this._get(this.canvas.height, 0, option.pos.y, 'pos') + lineheight;

    // data:字体数据；
    // lineWidth:行宽；
    this.textData[line] = {
        data: [],
        lineWidth: 0
    };

    // 生成字体数据；
    textArr.forEach(function (v) {
        style = option[v.type + 'Style'];
        _this4.ctx.font = style.font;
        var width = _this4.ctx.measureText(v.text).width;

        // 处理 <br> 换行，先替换成 '|',便于单字绘图时进行判断；
        var context = v.text.replace(/<br>/g, '|');

        // 先进行多字超出判断，超出宽度后再进行单字超出判断；
        if (length + width > option.width || context.indexOf('|') !== -1) {
            for (var i = 0, fontLength = context.length; i < fontLength; i++) {
                var font = context[i];
                width = _this4.ctx.measureText(font).width;

                // 当字体的计算宽度 > 设置的宽度 || 内容中包含换行时,进入换行逻辑；
                if (length + width > option.width || font == '|') {
                    length = 0;
                    x = _this4._get(_this4.canvas.width, option.width, option.pos.x, 'pos');
                    y += lineheight;
                    line += 1;
                    _this4.textData[line] = {
                        data: [],
                        lineWidth: 0
                    };
                    if (font == '|') continue;
                }
                _this4.textData[line]['data'].push({
                    context: font, x: x, y: y, style: style, width: width
                });
                length += width;
                x += width;
                _this4.textData[line]['lineWidth'] = length;
            }
        } else {
            _this4.textData[line]['data'].push({
                context: context, x: x, y: y, style: style, width: width
            });
            length += width;
            x += width;
            _this4.textData[line]['lineWidth'] = length;
        }
    });

    // 通过字体数据进行文字的绘制；
    _.forin(this.textData, function (k, v) {
        // 增加 align 的功能；
        var add = 0;
        if (v.lineWidth < option.width) {
            if (option.align == 'center') {
                add = (option.width - v.lineWidth) / 2;
            } else if (option.align == 'right') {
                add = option.width - v.lineWidth;
            }
        }
        v.data.forEach(function (text) {
            text.x += add;
            _this4._fillText(text);
        });
    });

    // 获取行高；
    function getLineHeight(textArr, option) {
        var lh = 0,
            vlh = void 0;
        textArr.forEach(function (v) {
            vlh = option[v.type + 'Style'].lineheight;
            if (vlh > lh) lh = vlh;
        });
        return lh;
    }
};
MCanvas.prototype._fillText = function (text) {
    var context = text.context,
        x = text.x,
        y = text.y,
        style = text.style;

    this.ctx.font = style.font;
    this.ctx.textAlign = style.align;
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillStyle = style.color;
    this.ctx.fillText(context, x, y);
};

// --------------------------------------------------------
// 业务功能函数部分
// --------------------------------------------------------

// 参数加工函数；
// 兼容 5 种 value 值：
// x:250, x:'250px', x:'100%', x:'left:250',x:'center',
// width:100,width:'100px',width:'100%'
MCanvas.prototype._get = function (par, child, str, type) {
    var result = str;
    if (typeof str === 'string') {
        if (str.indexOf(':') !== -1 && type == 'pos') {
            var arr = str.split(':');
            switch (arr[0]) {
                case 'left':
                case 'top':
                    result = +arr[1].replace('px', '');
                    break;
                case 'right':
                case 'bottom':
                    result = par - +arr[1].replace('px', '') - child;
                    break;
                default:
            }
        } else if (str.indexOf('px') !== -1) {
            result = +str.replace('px', '');
        } else if (str.indexOf('%') !== -1) {
            if (type == 'crop') {
                result = child * +str.replace('%', '') / 100;
            } else {
                result = par * +str.replace('%', '') / 100;
            }
        } else if (str == 'center') {
            result = (par - child) / 2;
        } else {
            result = +str;
        }
    }
    return result;
};

// 绘制函数；
MCanvas.prototype.draw = function () {
    var _this5 = this;

    var fn = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

    var b64 = void 0;
    this.end = function () {
        setTimeout(function () {
            b64 = _this5.canvas.toDataURL('image/png');
            fn(b64);
        }, 0);
    };
    this._next();
    return this;
};
MCanvas.prototype._next = function () {
    if (this.queue.length > 0) {
        this.queue.shift()();
    } else {
        this.end();
    }
};

return MCanvas;

})));
//# sourceMappingURL=mcanvas.js.map
