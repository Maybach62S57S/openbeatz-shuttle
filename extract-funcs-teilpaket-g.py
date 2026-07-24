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

# Basis-Deklarationen (wie Teilpaket E) + F-Actionable + Teilpaket-G-Kern.
order = ["toMin","pad","localDateISO","todayISO","sortMin","dayNowMin","festDayKey","driverDay",
         "travel","travelMin","effDur","issueOpen","rideHasOpenIssue","validPassengerCount",
         "DRIVER_PROFILES","TEAM_LABEL","normDriverName","driverProfile","driverCategoryOf",
         "teamGroupOf","teamLabelOf","availableFromOf","parseWallClock","checkDriverAvailability",
         "stateLocationId","computeDriverStats",
         "LOC_ZONE","ZONE_LABEL","LOC_MATRIX_NODE","LOC_ALIASES","KNOWN_FIXED_IDS","PICKUP_RULES",
         "normLoc","resolveLocation","resolveRideEndpoint","resolveOperationalRideLocations",
         "resolveTravelMinutes","rideEndpointMatrixNode","evaluateInsertion",
         "rideFestivalDirection","c3RideStartAbsMin","c3AbsToParts","c3OperationalNodes",
         "RETURN_STATUS_COMPLETED","RETURN_STATUS_ACTIVE","GROUP_RIDE_ACTIONABLE",
         # Teilpaket G1
         "REPOSITION_CONFIG","REPOSITION_STATUS_LABEL","REPOSITION_STATUS_ORDER","REPOSITION_ACTIONABLE",
         "REPOSITION_DEMAND_GROUPS","REPOSITION_DEMAND_WEIGHT",
         "repositionLocLabel","repositionRideEndAbs","deriveDriverPlannedPosition","repositionNextAssignedRide",
         "repositionDemandScore","repositionFreeDriverCoverage","repositionReachableOpenRides",
         "REPOSITION_ACTIONABLE_GROUP","evaluateDriverRepositionSuggestion","repositionCompare",
         "rankRepositionSuggestions","buildRepositionSuggestions"]
pieces=[]; got=[]
for n in order:
    b=grab_any(n)
    if b: pieces.append(b); got.append(n)
open(outfile,"w",encoding="utf-8").write(
    "// AUTO - verbatim aus src/ShuttleLeitstelle.jsx extrahiert\n"+"\n\n".join(pieces)+
    "\n\nexport { travelMin, computeDriverStats, evaluateInsertion, c3RideStartAbsMin, c3AbsToParts, "
    "c3OperationalNodes, REPOSITION_CONFIG, REPOSITION_STATUS_LABEL, REPOSITION_STATUS_ORDER, "
    "REPOSITION_ACTIONABLE, REPOSITION_DEMAND_GROUPS, REPOSITION_DEMAND_WEIGHT, repositionLocLabel, "
    "repositionRideEndAbs, deriveDriverPlannedPosition, repositionNextAssignedRide, repositionDemandScore, "
    "repositionFreeDriverCoverage, repositionReachableOpenRides, evaluateDriverRepositionSuggestion, "
    "repositionCompare, rankRepositionSuggestions, buildRepositionSuggestions };\n")
print(f"{outfile}: {len(pieces)} Bloecke")
print("fehlend:", [n for n in order if n not in got])
