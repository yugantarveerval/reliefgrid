# Generates a large labelled dataset of disaster help requests and trains a
# Naive Bayes (category) + ordinal severity model. Exports public/model.json.
import random,re,json,math,csv,collections
random.seed(7)
C={"medical":["injured","bleeding badly","fracture in leg","needs insulin","high fever","chest pain","heart patient without medicines","pregnant woman in labour","wound is infected","asthma attack no inhaler","unconscious","needs oxygen cylinder","dressing and bandage needed","dawai chahiye","doctor chahiye","ghayal","dard bahut hai","bukhar tez hai","khoon beh raha hai","saans nahi le pa raha","dil ka daura","chot lagi hai"],
"food":["no food since yesterday","hungry children","need ration packets","baby milk finished","cooked meals needed","kitchen supplies washed away","khana chahiye","bhookh se pareshan","need rice and dal","no groceries left","community kitchen needed","biscuits and bread needed","bhukhe hain","anaj khatam","raashan chahiye","khane ko kuch nahi"],
"water":["no drinking water","water is contaminated","need clean water bottles","tanker needed","wells polluted","dehydration among people","paani chahiye","pani nahi hai","water purification tablets needed","handpump submerged","need water cans","peene ka paani nahi","gandha paani","paani ka tanker bhejo"],
"shelter":["house collapsed","roof blown away","need tents","need blankets","homeless after quake","sleeping in open in cold","need tarpaulin","ghar toot gaya","need warm clothes","relief camp needed","walls cracked unsafe to stay","need mattresses","tambu chahiye","kambal chahiye","chhat gir gayi","bepanah ho gaye","raat bahar guzari"],
"rescue":["trapped under rubble","stuck on rooftop in flood","stranded by rising water","landslide blocked the road","missing family members","boat needed","fire in building","people trapped in car","bachao","fasa hua hai","cut off by flood","tree fell on house people inside","chhat par fase hain","paani me phanse hain","fase hue log","paani bhar gaya ghar me","malbe me dabe hain","bahaav me phans gaye"]}
OPEN=["","please help","help","we need help","urgent request","reporting from village","sos","near the market","at the school","colony me","in our street",""]
TIER={1:["whenever possible","not urgent","no rush"],2:["as soon as possible","by tonight"],3:["soon","situation getting worse"],4:["urgent","very urgent","need help today","immediately","jaldi"],5:["critical","life threatening","emergency","dying","right now please","every minute counts","turant"]}
VUL=["child","children","baby","elderly","old man","senior citizens","pregnant","disabled","wheelchair user","bachche","bujurg"]
def noise(w):
    if len(w)>4 and random.random()<.06:
        i=random.randrange(1,len(w)-1);w=w[:i]+w[i+1:]
    return w
def make(cat,sev):
    p=[random.choice(C[cat])]
    if random.random()<.25:p.append(random.choice(C[random.choice([c for c in C if c!=cat])]))  # distractor
    if random.random()<.5:p.insert(0,random.choice(OPEN))
    n=random.choice([1,2,3,4,5,8,10,15,20,30,50,100,200]);
    if random.random()<.7:p.append(random.choice([f"{n} people",f"{n} persons",f"family of {n}",f"{n} log"]))
    v=random.random()<.3
    if v:p.append(random.choice(VUL))
    # severity cues: mostly from its own tier, sometimes adjacent
    tier=min(5,max(1,sev+random.choice([0,0,0,0,1,-1])))
    p.append(random.choice(TIER[tier]))
    if cat in("rescue","medical") and sev>=4 and random.random()<.5:p.append("trapped" if cat=="rescue" else "bleeding")
    random.shuffle(p) if random.random()<.15 else None
    t=" ".join(p).lower(); t=" ".join(noise(w) for w in t.split())
    return t,v,n
def tok(t):return re.findall(r"[a-z0-9]+",t.lower())
def feats(t):
    w=tok(t);f=set(w)|{"p:"+x[:5] for x in w if len(x)>=5}
    f|={a+"_"+b for a,b in zip(w,w[1:])};return f
N=80000;data=[]
for i in range(N):
    c=random.choice(list(C));s=random.choices([1,2,3,4,5],[1,2,3,3,2])[0]
    t,v,n=make(c,s);data.append((t,c,s,int(v),n))
import os,json as _j
def clean(t):
    t=re.sub(r"http\S+|@\w+|\bRT\b|&amp;"," ",t);return re.sub(r"\s+"," ",t).strip().lower()
REQ=[("water",["water","drink","thirst"]),("food",["food","meal","hungry","ration","eat"]),("medical",["medic","doctor","hospital","blood","injur","insulin","first aid","ambulance"]),("shelter",["shelter","tent","blanket","cloth","housing","homeless","roof"]),("rescue",["rescue","trapped","stranded","rubble","boat","helicopter"])]
MAP={"injured_or_dead_people":"medical","displaced_people_and_evacuations":"shelter","missing_or_found_people":"rescue"}
POS={"requests_or_urgent_needs","injured_or_dead_people","displaced_people_and_evacuations","missing_or_found_people"}
NEG={"sympathy_and_support","not_humanitarian","other_relevant_information","caution_and_advice"}
def load(files):
    cat,act,seen=[],[],set()
    for fn in files:
        if not os.path.exists(fn):continue
        for l in open(fn,encoding="utf-8"):
            d=_j.loads(l);t=clean(d["tweet_text"]);y=d["class_label"]
            if len(t)<15 or t in seen:continue
            seen.add(t)
            c=MAP.get(y)
            if y=="requests_or_urgent_needs":
                c=next((k for k,ws in REQ if any(w in t for w in ws)),None)
            if c:cat.append((t,c,3,0,1))
            if y in POS:act.append((t,"yes",3,0,1))
            elif y in NEG:act.append((t,"no",3,0,1))
    return cat,act
real_tr,act_tr=load(["humaid/train.jsonl","humaid/dev.jsonl"]);real_te,act_te=load(["humaid/test.jsonl"])
print("real HumAID rows -> category train",len(real_tr),"test",len(real_te),"| actionable train",len(act_tr),"test",len(act_te))
random.shuffle(data);cut=int(N*.85);tr,te=data[:cut],data[cut:]
with open("dataset.csv","w",newline="") as f:
    w=csv.writer(f);w.writerow(["text","category","severity","vulnerable","people"]);w.writerows(data)
def train(idx,labels,tr=None):
    tr=tr or globals()['tr']
    cc=collections.Counter(r[idx] for r in tr);fc={l:collections.Counter() for l in labels}
    for r in tr:
        for x in feats(r[0]):fc[r[idx]][x]+=1
    tot=collections.Counter()
    for l in labels:
        for x,k in fc[l].items():tot[x]+=k
    vocab=[x for x,k in tot.items() if k>=15];V=len(vocab)
    lp={l:{x:round(math.log((fc[l][x]+1)/(cc[l]+2)),3) for x in vocab} for l in labels}
    ln={l:{x:round(math.log(1-(fc[l][x]+1)/(cc[l]+2)),3) for x in vocab} for l in labels}
    prior={l:round(math.log(cc[l]/len(tr)),3) for l in labels}
    return {"labels":labels,"vocab":vocab,"prior":prior,"lp":lp,"ln":{l:round(sum(ln[l].values()),3) for l in labels},"ln_each":ln}
def predict(m,t):
    f=feats(t);best=None
    for l in m["labels"]:
        s=m["prior"][l]+m["ln"][l]
        for x in f:
            if x in m["lp"][l]:s+=m["lp"][l][x]-m["ln_each"][l][x]
        if best is None or s>best[0]:best=(s,l)
    return best[1]
out={}
def acc(m,rows,idx=1):return sum(predict(m,r[0])==r[idx] for r in rows)/max(1,len(rows))
def pack(m,labels):
    m["w"]={l:{x:round(m["lp"][l][x]-m["ln_each"][l][x],3) for x in m["vocab"]} for l in labels};del m["lp"],m["ln_each"],m["vocab"];return m
cats=list(C)
base=train(1,cats)                       # synthetic only
mixed=train(1,cats,tr+real_tr); mixed["prior"]={l:round(math.log(1/5),3) for l in cats}        # synthetic + real HumAID
print("category | synthetic test: synth-only %.3f, mixed %.3f"%(acc(base,te),acc(mixed,te)))
print("category | REAL HumAID test (%d rows): synth-only %.3f, mixed %.3f"%(len(real_te),acc(base,real_te),acc(mixed,real_te)))
sv=train(2,[1,2,3,4,5]);print("severity | synthetic test exact %.3f"%acc(sv,te,2))
ys=[(t,"yes",0,0,0) for t,_,_,_,_ in tr[:20000]]
am=train(1,["no","yes"],act_tr*3+ys)
pos=[r for r in act_te if r[1]=="yes"];neg=[r for r in act_te if r[1]=="no"]
print("actionable | REAL test: overall %.3f, recall of actionable %.3f, non-actionable caught %.3f | synthetic requests flagged actionable %.3f"%(acc(am,act_te),acc(am,pos),acc(am,neg),acc(am,[(t,"yes") for t,_,_,_,_ in te[:3000]])))
out={"category":pack(mixed,cats),"severity":pack(sv,[1,2,3,4,5]),"action":pack(am,["no","yes"])}
out["meta"]={"synthetic":N,"humaid_category_rows":len(real_tr),"humaid_action_rows":len(act_tr)}
json.dump(out,open("public/model.json","w"),separators=(",",":"))
