;(function () {
  // easeOutElastic算法
  function elastic(t, p) {
    return t === 0 || t === 1 ? t :
      -Math.pow(2, 10 * (t - 1)) * Math.sin((((t - 1) - (p / (Math.PI * 2.0) * Math.asin(1))) * (Math.PI * 2)) / p);
  }
  let animeFunc = (t, f) => 1 - elastic(1 - t, f)

  // 保证val在min和max范围内
  function minMaxValue(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  let raf = 0, activeInstances = [];
  // anime的核心机制，使用requestAnimateFrame
  // IIFE 之后调用engine相当于执行内部的play
  const engine = (() => {
    function play() {
      raf = requestAnimationFrame(step);
    };
    // 这里的参数t是 raf的参数中可以接受的一个时间戳，表示触发调用的时间
    function step(t) {
      const activeLength = activeInstances.length;
      // 存在正在运行的动画
      if (activeLength) {
        let i = 0;
        while (i < activeLength) {
          // 实例是存在的
          if (activeInstances[i]) {
            // 执行
            activeInstances[i].tick(t)
          }
          i++;
        }
        // 递归执行
        play();
      } else {
        // 不存在正在运行的动画 cancel
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
    return play;
  })();

  function MyAnime(options) {
    let defaultOptions = {
      // DomNodes
      targets: [],
      // 要动画的队列
      // 从什么位置开始
      from: 0,
      // 到什么位置
      to: 0,
      // 持续时间
      duration: 1200,
      // 延迟时间
      delay: 0,
      // 更新函数，每次进度变动都会更新
      update: null,
      // 弹性参数
      elasticity: 500
    }
    // 合并配置
    let finalOpts = Object.assign({}, defaultOptions, options)

    this.paused = true
    this.animations = []
    this.currentTime = 0
    this.reversed = false

    let engineTime, lastTime, startTime, now;
    let elasticity = typeof finalOpts.elasticity === "function" ? finalOpts.elasticity : () => finalOpts.elasticity

    let targets = finalOpts.targets,
      fromNumber = finalOpts.from,
      toNumber = finalOpts.to,
      insDuration = finalOpts.duration,
      delay = finalOpts.delay,
      callBackUpdate = finalOpts.update
    let _this = this;

    // 反转状态改变
    function toggleInstanceDirection() {
      _this.reversed = !_this.reversed;
    }
    // 如果是反转状态，时间也反转(位置才能反转)
    function adjustTime(time) {
      return _this.reversed ? insDuration - time : time;
    }

    // 初始化，将需要进行的动画次数添加至animations，后续遍历执行
    this.init = function () {
      for (let i = 0; i < targets.length; i++) {
        let _delay = typeof delay === "function" ? delay(i) : delay
        this.animations.push({target: targets[i], delay: _delay})
      }
      let maxDelay=Math.max.apply(Math,this.animations.map(anim => anim.delay))
      insDuration+=maxDelay
    }
    this.init()

    // 配置 startTime 和 engineTime
    this.tick = function (t) {
      now = t;
      // startTime 如果首次执行 就是now，否则就是上一次tick的时间
      if (!startTime) startTime = now;
      // lastTime 是上一次执行结束后动画对应位置的时间戳
      // engineTime 是到动画目前为止消耗的总时间，一般理论上讲是lastTime+16.6667
      engineTime = (lastTime + now - startTime)
      setInstanceProgress(engineTime)
    }

    // 对当前engineTime进行判断，确定动画方案
    function setInstanceProgress(engineTime) {
      // 如果有reverse 就要反过来
      const insTime = adjustTime(engineTime);
      // 小于持续时间
      if (insTime < insDuration) {
        setAnimationsProgress(insTime)
        // 超出了持续时间 并且当前位置不在终点  或者 未设定持续时间
      } else if ((insTime >= insDuration && _this.currentTime !== insDuration) || !insDuration) {
        setAnimationsProgress(insDuration)
      }
      // 调用update，配合range
      if (callBackUpdate) callBackUpdate(_this)
      // 消耗时间大于持续时间 并且在终点(不在终点的上面已经判断了)
      if (engineTime >= insDuration) {
        // 完成动画的执行
        _this.pause();
        if (!_this.completed) {
          _this.completed = true;
        }
        lastTime = 0;
      }
    }

    // 计算动画当前位置 并且赋值
    function setAnimationsProgress(insTime) {
      let i = 0
      let numbers = [];
      // animations是 init 方法添加的需要进行的动画的所有target
      while (i < _this.animations.length) {
        // 消耗的时间占总持续时间的比例 在起点终点之间
        let elapsed = minMaxValue((insTime - _this.animations[i].delay), 0, insDuration) / insDuration
        // 算法算出当前位置比例
        const eased = isNaN(elapsed) ? 1 : animeFunc(elapsed, (1000 - minMaxValue(elasticity(), 1, 999)) / 1000);
        // 计算当前具体位置
        let value = fromNumber + (eased * (toNumber - fromNumber));
        numbers.push(value)
        i++;
      }
      // 遍历结果，逐个赋值
      for (let i = 0; i < numbers.length; i++) {
        _this.animations[i].target.style.transform = 'translateX(' + numbers[i] + 'px)'
      }
      // 记录当前位置所对应的时间
      _this.currentTime = insTime
      _this.progress = (insTime / insDuration) * 100;
    }

    // 外部API 从当前位置开始执行动画
    this.play = function () {
      if (!this.paused) return
      this.paused = false
      // 从0 开始
      startTime = 0;
      // 调取当前动画当前位置所对应的时间
      lastTime = adjustTime(this.currentTime)
      // 给 activeInstances 添加当前实例，说明这是一个正在运行的动画
      activeInstances.push(this)
      if (!raf) engine()
    }

    // 外部API 删除activeInstances 后续engine中找不到便不会执行
    this.pause = function () {
      // 找出当前正在运行的动画并且删除
      const i = activeInstances.indexOf(this);
      if (i > -1) activeInstances.splice(i, 1);
      this.paused = true;
    }

    // 直接跳到参数time的时间所在的位置
    this.seek = function (time) {
      setInstanceProgress(adjustTime(time));
    }

    // 外部API reset
    this.reset = function () {
      // 可以在执行时重置
      this.pause()
      this.currentTime = 0;
      this.paused = true;
      this.completed = false;
      if (this.reversed) {
        this.progress = insDuration;
        setAnimationsProgress(insDuration);
      } else {
        this.progress = 0;
        setAnimationsProgress(0);
      }
      // 调用update，配合range
      callBackUpdate(_this)
    }
    // 外部API 重新开始
    this.restart = function () {
      this.pause()
      this.reset()
      this.play()
    }

    // 外部API 反转
    this.reverse = function () {
      toggleInstanceDirection();
      startTime = 0;
      lastTime = adjustTime(this.currentTime);
    }
  }
  window.MyAnime=MyAnime
})()