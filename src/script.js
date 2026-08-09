import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Experience from './Experience/Experience.js'

gsap.registerPlugin(ScrollTrigger)
const experience = new Experience(document.querySelector('canvas.webgl'))

const scrollerEl = document.getElementById('fake-scroll')
if (scrollerEl) {
    ScrollTrigger.defaults({ scroller: scrollerEl })
    scrollerEl.addEventListener('scroll', () => ScrollTrigger.update(), { passive: true })
}

function initTextEffects() {
    const containers = document.querySelectorAll('[data-text-effect]')
    if (!containers.length) return

    function splitChars(target) {
        const frag = document.createDocumentFragment()
        Array.from(target.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                for (const c of node.textContent) {
                    if (/^\s$/.test(c)) {
                        frag.appendChild(document.createTextNode(c))
                    } else {
                        const span = document.createElement('span')
                        span.className = 'char'
                        span.textContent = c
                        frag.appendChild(span)
                    }
                }
            } else {
                frag.appendChild(node.cloneNode(true))
            }
        })
        target.innerHTML = ''
        target.appendChild(frag)
    }

    function splitWords(target) {
        const frag = document.createDocumentFragment()
        Array.from(target.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const parts = node.textContent.split(/(\s+)/)
                parts.forEach((token) => {
                    if (/^\s+$/.test(token)) {
                        frag.appendChild(document.createTextNode(token))
                    } else {
                        const wordSpan = document.createElement('span')
                        wordSpan.className = 'word'
                        for (const c of token) {
                            const span = document.createElement('span')
                            span.className = 'char'
                            span.textContent = c
                            wordSpan.appendChild(span)
                        }
                        frag.appendChild(wordSpan)
                    }
                })
            } else {
                frag.appendChild(node.cloneNode(true))
            }
        })
        target.innerHTML = ''
        target.appendChild(frag)
    }

    function splitWordsOnly(target) {
        const open = '<span class="word">'
        const close = '</span>'
        target.innerHTML = target.textContent
            .split(/(\s+)/)
            .map((token) => {
                if (/^\s+$/.test(token)) return token
                return open + token + close
            })
            .join('')
    }

    containers.forEach((container) => {
        const effect = container.dataset.textEffect
        const targets = container.querySelectorAll('[data-text-effect-target]')
        if (!targets.length) return

        if (effect === '28') {
            targets.forEach((target) => {
                if (target.dataset.splitDone === '1') return
                splitWords(target)
                const words = target.querySelectorAll('.word')
                words.forEach((word) => {
                    const chars = word.querySelectorAll('.char')
                    const len = chars.length
                    const half = Math.ceil(len / 2)
                    gsap.fromTo(chars, {
                        willChange: 'transform, filter',
                        transformOrigin: '50% 100%',
                        scale: (i) => {
                            const idx = i < half ? i : half - 1 - (i - half)
                            return gsap.utils.mapRange(0, half - 1, 0.5, 2.1, idx)
                        },
                        y: (i) => {
                            const idx = i < half ? i : half - 1 - (i - half)
                            return gsap.utils.mapRange(0, half - 1, 0, 60, idx)
                        },
                        rotation: (i) => {
                            const idx = i < half ? i : half - 1 - (i - half)
                            const val = gsap.utils.mapRange(0, half - 1, 4, 0, idx)
                            return i < half ? -val : val
                        },
                        filter: 'blur(12px) opacity(0)'
                    }, {
                        ease: 'power2.inOut',
                        y: 0, rotation: 0, scale: 1,
                        filter: 'blur(0px) opacity(1)',
                        stagger: { amount: 0.15, from: 'center' },
                        scrollTrigger: {
                            trigger: word,
                            start: 'top bottom',
                            end: 'bottom top',
                            scrub: true
                        }
                    })
                    chars.forEach((c) => gsap.set(c.parentNode, { perspective: 2000 }))
                })
                target.dataset.splitDone = '1'
            })
        } else if (effect === '18') {
            // 第 6 页 effect18: 手动滚动驱动,每个 char 滚进 viewport 时从 y:40 升起 + 淡入
            // 用 start='top bottom' / end='top top',100vh 滚动内 progress 0->100%
            // (之前用 'bottom top' 时 maxScroll 永远到不了,卡 50%;现在改 'top top' 才稳)
            targets.forEach((target) => {
                if (target.dataset.splitDone === '1') return
                splitChars(target)
                const chars = target.querySelectorAll('.char')
                chars.forEach((c) => gsap.set(c.parentNode, { perspective: 1000 }))
                gsap.fromTo(chars, {
                    willChange: 'opacity, transform',
                    opacity: 0.1,
                    y: 40
                }, {
                    opacity: 1,
                    y: 0,
                    stagger: 0.04,                       // 每个字间隔 40ms
                    scrollTrigger: {
                        trigger: target.parentNode,
                        start: 'top bottom+=5%',           // trigger 进入 viewport 底部 5vh 时 progress 0%(可视起点)
                        end: 'top top+=50%',               // trigger.top 还差 50vh 抵达 viewport.top 时 progress 100%
                        // 第 6 页是网页底部,maxScroll ≈ 'top top' 附近,把 end 大幅提前 50vh
                        // 这样 maxScroll 时已经定格,留 50vh 给滚轮缓冲,文字全亮
                        scrub: true                        // 跟随滚动条(老大要手动滑动)
                    }
                })
                target.dataset.splitDone = '1'
            })
        } else if (effect === '23') {
            // Tympanus effect23 (Deeper Love Light): 奇偶 word 反方向缩放飞入
            // 每个 word 内 chars: scale 0.01->1 + x 偏移 (偶数 word chars 向左,奇数 word chars 向右)
            // scrub mode, trigger = word (各 word 独立触发)
            targets.forEach((target) => {
                if (target.dataset.splitDone === '1') return
                splitWords(target)
                const xWords = target.querySelectorAll('.word')
                xWords.forEach((word, wi) => {
                    const xChars = word.querySelectorAll('.char')
                    if (!xChars.length) return
                    gsap.fromTo(xChars, {
                        willChange: 'transform',
                        scale: 0.01,
                        x: (i, _c, arr) => wi % 2 ? 50 * i : -50 * (arr.length - i - 1)
                    }, {
                        ease: 'power4',
                        scale: 1,
                        x: 0,
                        scrollTrigger: {
                            trigger: word,
                            start: 'center bottom',
                            end: 'bottom top-=40%',
                            scrub: true
                        }
                    })
                })
                target.dataset.splitDone = '1'
            })
        } else if (effect === '20') {
            targets.forEach((target) => {
                if (target.dataset.splitDone === '1') return
                splitChars(target)
                const chars = target.querySelectorAll('.char')
                // target 可能是 h2 内的 inline <span>,perspective 设在 .char 自身(inline-block)才生效
                chars.forEach((c) => gsap.set(c, { perspective: 2000 }))
                gsap.fromTo(chars, {
                    willChange: 'transform, opacity',
                    transformOrigin: '50% 100%',
                    opacity: 0,
                    rotationX: 90
                }, {
                    ease: 'power4',
                    opacity: 1,
                    rotationX: 0,
                    stagger: { each: 0.03, from: 'random' },
                    scrollTrigger: {
                        // trigger 用 h2 (block, 高度正常) 而不是 inline span,ScrollTrigger 才能正确检测
                        trigger: target.parentNode,
                        start: 'center bottom',
                        end: 'bottom top+=20%',
                        scrub: true
                    }
                })
                target.dataset.splitDone = '1'
            })
        } else if (effect === '21') {
            targets.forEach((target) => {
                if (target.dataset.splitDone === '1') return
                splitWords(target)
                const words = target.querySelectorAll('.word')
                words.forEach((word) => {
                    const chars = word.querySelectorAll('.char')
                    const len = chars.length
                    chars.forEach((c) => gsap.set(c.parentNode, { perspective: 2000 }))
                    gsap.fromTo(chars, {
                        willChange: 'transform, opacity',
                        y: (i) => -40 * Math.abs(i - (len - 1) / 2),
                        z: () => gsap.utils.random(-1500, -600),
                        rotationX: () => gsap.utils.random(-500, -200),
                        scale: 0.05,
                        opacity: 0
                    }, {
                        ease: 'power1.inOut',
                        y: 0, z: 0, rotationX: 0, scale: 1, opacity: 1,
                        stagger: { each: 0.06, from: 'center' },
                        scrollTrigger: {
                            trigger: word,
                            start: 'top bottom',
                            end: 'top top+=15%',
                            scrub: true
                        }
                    })
                })
                target.dataset.splitDone = '1'
            })
        } else if (effect === '16') {
            targets.forEach((target) => {
                if (target.dataset.splitDone === '1') return
                splitWordsOnly(target)
                target.dataset.splitDone = '1'
            })
            targets.forEach((target) => {
                const words = target.querySelectorAll('.word')
                if (!words.length) return
                gsap.fromTo(words, {
                    willChange: 'opacity',
                    opacity: 0.1
                }, {
                    ease: 'none',
                    opacity: 1,
                    stagger: 0.05,
                    // 第 6 页 (page-fairy) 走跟 effect18 一样的早结束区间 (留 50vh 缓冲给 maxScroll),
                    // 其他段 (1-5) 保留原 'top bottom-=20%' / 'center top+=20%' 不动
                    scrollTrigger: {
                        trigger: container,
                        start: container.closest('#page-fairy') ? 'top bottom+=5%' : 'top bottom-=20%',
                        end: container.closest('#page-fairy') ? 'top top+=50%' : 'center top+=20%',
                        scrub: true
                    }
                })
            })
        }
    })
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTextEffects)
} else {
    initTextEffects()
}
