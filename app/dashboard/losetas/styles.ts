export const CALCULATOR_STYLES = `
.pys-calc * { box-sizing: border-box; }
.pys-calc {
  font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  background: #f2f1ec;
  margin: 0;
  padding: 24px;
  color: #222;
}
.pys-calc .wrap {
  max-width: 940px;
  margin: 0 auto;
  background: #fff;
  border-radius: 14px;
  padding: 32px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.pys-calc h1 { font-size: 22px; margin: 0 0 4px; color: #1B3A5C; }
.pys-calc .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
.pys-calc .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.pys-calc .row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.pys-calc label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.pys-calc input, .pys-calc select { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; background: #fff; }
.pys-calc input:focus, .pys-calc select:focus { outline: 2px solid #1B3A5C; border-color: #1B3A5C; }
.pys-calc h3 { font-size: 14px; font-weight: 600; margin: 24px 0 10px; color: #1B3A5C; }
.pys-calc .plano-container { background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 24px; margin: 20px 0; overflow: visible; }
.pys-calc .brand { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.pys-calc .brand span { font-size: 12px; color: #999; }
.pys-calc .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.pys-calc .card { background: #F5F3EC; border-radius: 10px; padding: 14px 16px; }
.pys-calc .card .label { font-size: 12px; color: #777; }
.pys-calc .card .value { font-size: 22px; font-weight: 600; color: #1B3A5C; margin-top: 2px;}
.pys-calc .card.accent .value { color: #C0522D; }
.pys-calc .precio-section { border-top: 1px solid #eee; padding-top: 18px; margin-top: 8px; }
.pys-calc .checkrow { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.pys-calc .checkrow input[type="checkbox"] { width: auto; }
.pys-calc .checkrow label { margin-bottom: 0; font-size: 13px; color: #333; }
.pys-calc .subfield { margin-top: 8px; }
.pys-calc .btns { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
.pys-calc button { background: #1B3A5C; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
.pys-calc button:hover { background: #14304c; }
.pys-calc button.secondary { background: #fff; color: #1B3A5C; border: 1px solid #1B3A5C; }
.pys-calc button.secondary:hover { background: #f2f6fa; }
.pys-calc button.client { background: #C0522D; }
.pys-calc button.client:hover { background: #a3441f; }
.pys-calc button.danger-ghost { background: #fff; color: #a3441f; border: 1px solid #e2c4b8; padding: 6px 12px; font-size: 13px; }
.pys-calc button.danger-ghost:hover { background: #fbf0ec; }
.pys-calc button.reset { background: #fff; color: #666; border: 1px solid #ccc; }
.pys-calc button.reset:hover { background: #f5f5f5; }
.pys-calc button.add-material { background: #fff; color: #1B3A5C; border: 1px dashed #1B3A5C; padding: 8px 14px; font-size: 13px; width: 100%; margin-top: 6px; }
.pys-calc button.add-material:hover { background: #f2f6fa; }
.pys-calc button:disabled { opacity: 0.6; cursor: not-allowed; }
.pys-calc .helptext { font-size: 12px; color: #999; margin-top: 6px; }
.pys-calc .material-row { display: grid; grid-template-columns: 1fr 140px auto; gap: 10px; align-items: center; margin-bottom: 8px; }
.pys-calc .material-cost-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 14px; }

.pys-calc #client-capture {
  position: fixed;
  top: -99999px;
  left: -99999px;
  width: 1100px;
  background: #fff;
  padding: 44px;
  font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
.pys-calc #client-capture .chdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  border-bottom: 2px solid #1B3A5C;
  padding-bottom: 16px;
}
.pys-calc #client-capture .chdr img { height: 56px; }
.pys-calc #client-capture .chdr .ctitle { font-size: 20px; color: #1B3A5C; font-weight: 600; }
.pys-calc #client-capture .chdr .csub { font-size: 13px; color: #888; margin-top: 2px; }
.pys-calc #client-capture .cplano {
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 24px;
  background: #fcfcfa;
}
.pys-calc #client-capture .cfooter {
  margin-top: 20px;
  font-size: 11px;
  color: #aaa;
  text-align: center;
}
`;
