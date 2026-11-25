import { expect, test, type Page } from "@playwright/test";
import { previewClassSeries } from "../../../apps/admin/src/services/class-series";

const origin="http://127.0.0.1:3294";
const actor="76000000-0000-4000-8000-000000000001";
const gym="76000000-0000-4000-8000-000000000002";
const user={id:actor,aud:"authenticated",role:"authenticated",email:"series-staff@example.test",app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"};

async function fixture(page:Page, losePublicationResponse=false) {
  const calls={publications:[] as any[],announcements:[] as any[]};
  let series:any=null;
  let occurrences:any[]=[];
  let messages:any[]=[];
  await page.context().route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.addInitScript(({user,actor,gym})=>{
    const exp=Math.floor(Date.now()/1000)+3600;
    localStorage.setItem("kruxt-auth:127.0.0.1:9",JSON.stringify({access_token:`e30.${btoa(JSON.stringify({sub:actor,exp,role:"authenticated"}))}.fixture`,refresh_token:"fixture",expires_at:exp,token_type:"bearer",user}));
    localStorage.setItem("kruxt:selected-gym-id",gym);
  },{user,actor,gym});
  await page.route("http://127.0.0.1:9/auth/v1/user",route=>route.fulfill({json:user}));
  await page.route("http://127.0.0.1:9/rest/v1/**",route=>{
    const url=new URL(route.request().url());
    const table=url.pathname.split("/").at(-1);
    if(table==="platform_operator_accounts")return route.fulfill({json:null});
    if(table==="gym_memberships") {
      const row={id:"membership",gym_id:gym,user_id:actor,role:"leader",membership_status:"active"};
      return route.fulfill({json:url.searchParams.get("select")==="gym_id,role"?[row]:row});
    }
    if(table==="gyms")return route.fulfill({json:{id:gym,name:"Series fixture gym"}});
    if(table==="publish_gym_class_series") {
      const input=route.request().postDataJSON();calls.publications.push(input);
      const rows=previewClassSeries(input.p_draft).occurrences.filter(row=>row.status==="planned");
      occurrences=rows.map((row,index)=>({id:`76000000-0000-4000-8000-${String(index+10).padStart(12,"0")}`,series_id:input.p_draft.id,series_occurrence_key:row.key,title:input.p_draft.title,starts_at:row.startsAt,ends_at:row.endsAt,status:"scheduled"}));
      const receipt=occurrences.map(row=>({id:row.id,key:row.series_occurrence_key,startsAt:row.starts_at,endsAt:row.ends_at}));
      series={id:input.p_draft.id,gym_id:gym,title:input.p_draft.title,time_zone:input.p_draft.timeZone,capacity:input.p_capacity,created_by:actor,publication_receipt:receipt};
      if(losePublicationResponse)return route.abort("failed");
      return route.fulfill({json:{seriesId:series.id,occurrences:receipt,replayed:false}});
    }
    if(table==="gym_class_series")return route.fulfill({json:url.searchParams.has("id")?series:series?[series]:[]});
    if(table==="gym_classes")return route.fulfill({json:occurrences});
    if(table==="announce_gym_class_series") {
      const input=route.request().postDataJSON();calls.announcements.push(input);
      const id=`76000000-0000-4000-8000-${String(messages.length+100).padStart(12,"0")}`;
      const recipient_count=input.p_audience==="series_subscribers"?1:2;
      messages.push({id,gym_id:gym,request_id:input.p_request_id,created_by:actor,recipient_count});
      if(input.p_cancel_occurrence)occurrences=occurrences.map(row=>row.id===input.p_class_id?{...row,status:"cancelled"}:row);
      return route.fulfill({json:{announcementId:id,recipientCount:recipient_count,replayed:false,channel:"in_app"}});
    }
    if(table==="gym_class_announcements")return route.fulfill({json:messages.find(row=>url.searchParams.get("id")===`eq.${row.id}`||url.searchParams.get("request_id")===`eq.${row.request_id}`)||null});
    return route.fulfill({json:[]});
  });
  await page.goto(`${origin}/classes/series`);
  await expect(page.getByRole("heading",{name:"Class series",exact:true})).toBeVisible();
  return calls;
}

test("weekly bands publish six holiday-adjusted occurrences and target distinct communication scopes",async({page},info)=>{
  const calls=await fixture(page);
  page.on("dialog",dialog=>dialog.accept());
  await page.getByLabel("Class name",{exact:true}).fill("Spartan");
  await page.getByLabel("First date",{exact:true}).fill("2099-01-05");
  await page.getByLabel("Last date (inclusive)",{exact:true}).fill("2099-01-18");
  await page.getByRole("button",{name:"Add time band",exact:true}).click();
  await page.getByLabel("Monday for time band 2",{exact:true}).check();
  await page.getByLabel("Wednesday for time band 2",{exact:true}).check();
  const start=new Date("2099-01-05T00:00:00Z");
  start.setUTCDate(start.getUTCDate()+((2-(start.getUTCDay()||7)+7)%7));
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+1);
  await page.getByLabel("Break starts",{exact:true}).fill(start.toISOString().slice(0,10));
  await page.getByLabel("Break ends",{exact:true}).fill(end.toISOString().slice(0,10));
  await page.getByRole("button",{name:"Exclude break",exact:true}).click();
  await page.getByRole("button",{name:"Preview occurrences",exact:true}).click();
  await expect(page.getByText("6 planned · 2 excluded · 0 invalid times · Europe/Rome",{exact:true})).toBeVisible();
  await page.getByLabel("Capacity per occurrence",{exact:true}).fill("18");
  await page.getByRole("button",{name:"Review and publish classes",exact:true}).click();
  await expect(page.getByText("6 classes published.",{exact:true})).toBeVisible();
  expect(calls.publications).toHaveLength(1);
  expect(calls.publications[0].p_draft.slots).toHaveLength(4);
  expect(calls.publications[0].p_capacity).toBe(18);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath("class-series-published.png"),fullPage:true});
  const id=calls.publications[0].p_draft.id;
  await page.getByRole("combobox",{name:"Published series",exact:true}).selectOption(id);
  await page.getByLabel("Announcement",{exact:true}).fill("Schedule update for subscribers.");
  await page.getByRole("button",{name:"Review and post announcement",exact:true}).click();
  await expect(page.getByText(/Posted to 1 in-app inboxes/)).toBeVisible();
  await page.getByRole("combobox",{name:"Audience",exact:true}).selectOption("occurrence_attendees");
  await page.getByRole("combobox",{name:"Occurrence",exact:true}).selectOption("76000000-0000-4000-8000-000000000010");
  await page.getByLabel("Cancel this occurrence and its bookings with this announcement",{exact:true}).check();
  await page.getByLabel("Announcement",{exact:true}).fill("This occurrence is cancelled.");
  await page.getByRole("button",{name:"Review and post announcement",exact:true}).click();
  await expect(page.getByText(/Posted to 2 in-app inboxes/)).toBeVisible();
  expect(calls.announcements).toHaveLength(2);
  expect(calls.announcements[0]).toMatchObject({p_audience:"series_subscribers",p_class_id:null,p_cancel_occurrence:false});
  expect(calls.announcements[1]).toMatchObject({p_audience:"occurrence_attendees",p_cancel_occurrence:true});
  expect(calls.announcements[0].p_request_id).not.toBe(calls.announcements[1].p_request_id);
});

test("lost publication response survives reload and reconciles without publishing again",async({page})=>{
  const calls=await fixture(page,true);
  page.on("dialog",dialog=>dialog.accept());
  await page.getByLabel("Class name",{exact:true}).fill("Recoverable Spartan");
  await page.getByLabel("First date",{exact:true}).fill("2099-01-05");
  await page.getByLabel("Last date (inclusive)",{exact:true}).fill("2099-01-18");
  await page.getByRole("button",{name:"Preview occurrences",exact:true}).click();
  await page.getByLabel("Capacity per occurrence",{exact:true}).fill("17");
  await page.getByRole("button",{name:"Review and publish classes",exact:true}).click();
  await expect(page.getByRole("button",{name:"Retry unchanged publication",exact:true})).toBeVisible();
  expect(calls.publications).toHaveLength(1);
  const requestId=calls.publications[0].p_draft.id;
  await page.reload();
  await expect(page.getByText(`Unconfirmed publication: ${requestId}.`,{exact:false})).toBeVisible();
  await expect(page.getByLabel("Class name",{exact:true})).toHaveValue("Recoverable Spartan");
  await expect(page.getByLabel("Capacity per occurrence",{exact:true})).toHaveValue("17");
  await expect(page.getByLabel("Class name",{exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Verify previous publication",exact:true}).click();
  await expect(page.getByText("Previous publication confirmed.",{exact:true})).toBeVisible();
  expect(calls.publications).toHaveLength(1);
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.includes("class-series")&&sessionStorage.getItem(key)?.includes("Recoverable Spartan")))).toHaveLength(0);
});
