import { createWidget, widget, align, prop } from '@zos/ui'

// Cheetah Square screen: 390 x 450. Everything here is synchronous on purpose:
// Zepp OS 3.x firmware on this watch is reported to crash on background async work.
const W = 390
const H = 450
const ORANGE = 0xff8c1a

Page({
  state: { count: 0 },

  build() {
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: 0x000000 })

    createWidget(widget.TEXT, {
      x: 0, y: 60, w: W, h: 60,
      text: 'Hello,',
      color: 0xffffff,
      text_size: 40,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
    })

    createWidget(widget.TEXT, {
      x: 0, y: 120, w: W, h: 70,
      text: 'Dominique!',
      color: ORANGE,
      text_size: 52,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
    })

    const counter = createWidget(widget.TEXT, {
      x: 0, y: 210, w: W, h: 50,
      text: 'Taps: 0',
      color: 0x9a9a9a,
      text_size: 30,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
    })

    createWidget(widget.BUTTON, {
      x: (W - 240) / 2, y: 300, w: 240, h: 80,
      radius: 40,
      normal_color: ORANGE,
      press_color: 0xc96a10,
      text: 'Tap me',
      text_size: 32,
      color: 0x000000,
      click_func: () => {
        this.state.count += 1
        counter.setProperty(prop.TEXT, 'Taps: ' + this.state.count)
      },
    })
  },
})
