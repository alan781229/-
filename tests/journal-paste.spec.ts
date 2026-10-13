import {test,expect} from '@playwright/test';
test('直接貼上圖片可預覽並提供真正OCR掃描入口',async({page})=>{
 await page.goto('/');const toggle=page.getByRole('button',{name:'開啟選單'});if(await toggle.isVisible())await toggle.click();await page.getByRole('button',{name:'交易紀錄中心',exact:true}).click();
 const area=page.locator('.journal-paste');await area.focus();await area.evaluate(el=>{const binary=atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0s8AAAAASUVORK5CYII=');const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const data=new DataTransfer();data.items.add(new File([bytes],'paste.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await expect(area.getByAltText('交易紀錄截圖')).toBeVisible();await expect(page.getByRole('button',{name:'掃描圖片內容',exact:true})).toBeVisible();await page.getByRole('button',{name:'移除截圖',exact:true}).click();await expect(area.getByAltText('交易紀錄截圖')).toHaveCount(0);
});
