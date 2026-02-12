
#let my_style(
  body, // 文档正文内容，通常是最后一个位置参数
) = {
  // 1. 设置页面和基础文本样式
  set page(
    //页面设计
    paper: "a4", //纸张大小
    margin: (x: 1.5cm, y: 1.5cm, top: 1.5cm, bottom: 1.5cm),
    numbering: "1/1",
    header: [
      #set text(8pt)
      #smallcaps[信息学竞赛笔记/王书豪]
      #h(1fr) 时间:#datetime.today().display()
      #v(-7pt)
      #line(length: 100%, stroke: 0.5pt)//划线
    ],
  )
  set text(
    //字体
    font: ("Times New Roman", "STSong"),
    lang: "zh",
    region: "cn",
    size: 12pt,
    spacing: 8pt, //英文字符间距
    tracking: 0.8pt, //中文字符间距
  )

  // 设置代码块和行内代码字体
  // 行内代码（单个反引号 `code`）：使用 Times New Roman
  // 代码块（三个反引号 ```code```）：使用等宽字体
  show raw.where(block: false): it => {
    // 行内代码，使用 Times New Roman
    text(font: "Times New Roman", size: 12pt, it)
  }

  show raw.where(block: true): it => {
    // 代码块，使用等宽字体
    set text(font: ("Courier New", "Menlo", "Monaco", "STSong"))
    it
  }

  // 设置粗体样式：使用华文细黑，字号 11pt，粗细适中
  show strong: it => {
    text(font: ("Times New Roman", "STXihei"), size: 12pt, it)
  }

  // 设置图片 caption 样式：字体和字号
  show figure.caption: it => {
    text(font: ("Times New Roman", "STSong"), size: 8pt, it)
  }

  set par(
    //段落设置
    justify: true, //两端对齐
    first-line-indent: 2em, //首行缩进
    leading: 10pt, //行间距
    spacing: 12pt, // 段落间距
    // hanging-indent: 1.2em //整段缩进
  )
  set heading(
    numbering: (..args) => {
      let nums = args.pos()
      if nums.len() == 1 {
        return numbering("1.", ..nums) // 1级：第一章、第二章等
      }
      if nums.len() == 2 {
        // 2级标题处理
        // 如果没有1级标题（nums.at(0) == 0），需要继承最近的1级标题编号
        // 由于Typst的编号是全局连续的，我们需要找到最近的1级标题
        if nums.at(0) == 0 {
          // 这种情况下，假设最近的1级标题是1（第一章）
          // Typst会自动累加二级标题编号，所以直接使用
          return numbering("1.1", 1, nums.at(1))
        } else {
          // 有1级标题时，显示为 "1.1", "1.2" 等
          return numbering("1.1", ..nums)
        }
      }
      if nums.len() == 3 {
        // 3级标题处理
        // 如果前两级有0，需要调整
        let level1 = if nums.at(0) == 0 { 1 } else { nums.at(0) }
        let level2 = nums.at(1) // 二级标题编号直接使用，Typst会自动累加
        return numbering("1.1.1", level1, level2, nums.at(2))
      }
      if nums.len() == 4 {
        // 4级标题处理
        let level1 = if nums.at(0) == 0 { 1 } else { nums.at(0) }
        let level2 = nums.at(1)
        let level3 = nums.at(2)
        let level4_num = nums.at(3)
        // 四级标题使用数字编号：1), 2), 3) ...
        return numbering("1)", level4_num)
      }
    },
  )

  // 2. 之前的标题字体样式（不变，编号会自动叠加）
  show heading.where(level: 1): it => block(
    text(font: "Kaiti SC", weight: "bold", size: 15pt, it),
  )

  show heading.where(level: 2): it => block(
    text(font: "Kaiti SC", weight: "bold", size: 14pt, it),
  )

  show heading.where(level: 3): it => block(
    text(font: "Kaiti SC", weight: "bold", size: 13pt, it),
  )
  show heading.where(level: 4): it => block(
    text(font: "Kaiti SC", weight: "bold", size: 13pt, it),
  )

  // 4. 插入正文内容
  body
}

