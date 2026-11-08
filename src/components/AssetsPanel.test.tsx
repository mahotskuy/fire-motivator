import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AssetsPanel } from "./AssetsPanel";

describe("AssetsPanel", () => {
  it("AssetsPanel_PortfolioAsset_ShowsSharePriceAndPositionValueWithoutPurchaseOrPnlColumns", () => {
    const html = renderToStaticMarkup(
      <AssetsPanel
        assets={[{ ticker: "VWRA", shares: 2, avgBuyPrice: 150, marketPrice: 184.98, goalId: "fire" }]}
        goals={[]}
        monthlySave={500}
        onChange={vi.fn()}
        notify={vi.fn()}
      />,
    );

    expect(html).toContain("Поточна ціна акції ($)");
    expect(html).toContain("Вартість позиції ($)");
    expect(html).toContain('value="184.98"');
    expect(html).toContain("$369.96");
    expect(html).not.toContain("Сер. купівля");
    expect(html).not.toContain('value="150"');
    expect(html).not.toContain("P&amp;L");
    expect(html).not.toContain("+$70 (23.3%)");
  });
});
