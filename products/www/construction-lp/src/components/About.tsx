const rows = [
  ['会社名', '株式会社サンプル'],
  ['代表者', '代表取締役 〇〇 〇〇'],
  ['設立', '2005年4月'],
  ['所在地', '〒000-0000 〇〇県〇〇市〇〇 X-X-X'],
  ['電話番号', '00-0000-0000'],
  ['許可番号', '〇〇県知事許可（般-XX）第XXXXX号'],
  ['事業内容', '建築工事・リフォーム工事・外構工事・建設コンサルティング'],
  ['対応エリア', '〇〇県全域・近隣県'],
]

export default function About() {
  return (
    <section id="about" className="about">
      <div className="container">
        <div className="sec-header">
          <div className="sec-label">Company</div>
          <h2 className="sec-title">会社概要</h2>
          <div className="sec-bar" />
        </div>
        <table className="about-table">
          <tbody>
            {rows.map(([th, td]) => (
              <tr key={th}>
                <th>{th}</th>
                <td>{td}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
