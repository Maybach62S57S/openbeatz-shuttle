import sys
srcfile, outfile = sys.argv[1], sys.argv[2]
src = open(srcfile, encoding="utf-8").read()

def grab_const(name):
    key=f"const {name} " if f"const {name} " in src else f"const {name}="
    s=src.index(key); k=s; depth=0; started=False
    while k<len(src):
        c=src[k]
        if c in "{[(": depth+=1; started=True
        elif c in "}])": depth-=1
        elif c==";" and depth==0 and started: return src[s:k+1]
        k+=1

def grab_fn(name):
    s=src.index(f"function {name}(")
    p=src.index("(",s); depth=0; k=p
    while k<len(src):
        if src[k]=="(":depth+=1
        elif src[k]==")":
            depth-=1
            if depth==0: break
        k+=1
    j=src.index("{",k); depth=0; m=j
    while m<len(src):
        if src[m]=="{":depth+=1
        elif src[m]=="}":
            depth-=1
            if depth==0: return src[s:m+1]
        m+=1

def grab_any(name):
    if f"function {name}(" in src: return grab_fn(name)
    if f"const {name} " in src or f"const {name}=" in src: return grab_const(name)
    return None

# Reihenfolge nach Abhaengigkeit (Definitionen vor Nutzung wo noetig; ESM hoisting
# deckt function-decls, const-arrows brauchen Reihenfolge -> pad/sortMin zuerst)
order = ["toMin","pad","localDateISO","todayISO","sortMin","dayNowMin","driverDay","travel","travelMin","effDur",
         "logRide","issueOpen","rideHasOpenIssue","validPassengerCount","seedMatrix",
         "DRIVER_PROFILES","TEAM_LABEL","normDriverName","driverProfile","driverCategoryOf","teamGroupOf","teamLabelOf",
         "availableFromOf","parseWallClock","checkDriverAvailability","STATUS_TS","stateLocationId","computeDriverStats",
         "LOC_ZONE","ZONE_LABEL","LOC_MATRIX_NODE","LOC_ALIASES","KNOWN_FIXED_IDS","PICKUP_RULES",
         "normLoc","resolveLocation","resolveRideEndpoint","resolveOperationalRideLocations",
         "resolveTravelMinutes","rideEndpointMatrixNode",
         "evaluateInsertion","suggestDrivers"]
pieces=[]
for n in order:
    b=grab_any(n)
    if b: pieces.append(b)
open(outfile,"w",encoding="utf-8").write(
    "// AUTO\n"+"\n\n".join(pieces)+
    "\n\nexport { travelMin, computeDriverStats, evaluateInsertion, suggestDrivers, "
    "normLoc, resolveLocation, resolveRideEndpoint, resolveOperationalRideLocations, "
    "resolveTravelMinutes, rideEndpointMatrixNode, LOC_MATRIX_NODE, seedMatrix };\n")
print(f"{outfile}: {len(pieces)} Bloecke")
