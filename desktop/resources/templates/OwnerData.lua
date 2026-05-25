-- Module:OwnerData
--
-- Reads metadata about the wiki owner from their personal page,
-- resolved via the [[Me]] redirect. Exposes structured fields that
-- the Main Page banner uses without hardcoding personal data.
--
-- Usage:
--   {{#invoke:OwnerData|firstName}}    → "Jeremy"  (first token of page title, or Template:Name override)
--   {{#invoke:OwnerData|birthDate}}    → "1998-04-06"  ("" if not found)
--   {{#invoke:OwnerData|daysLived}}    → number of days since birth ("" if no birth date)
--
-- Birth-date extraction looks first for a structured `| birth = YYYY-MM-DD`
-- infobox parameter, then falls back to regex-parsing "born <Month> <day>,
-- <year>" or "born <day> <Month> <year>" from the page lead.

local p = {}

local MONTHS = {
    January = 1, February = 2, March = 3, April = 4,
    May = 5, June = 6, July = 7, August = 8,
    September = 9, October = 10, November = 11, December = 12,
    Jan = 1, Feb = 2, Mar = 3, Apr = 4, Jun = 6, Jul = 7,
    Aug = 8, Sep = 9, Sept = 9, Oct = 10, Nov = 11, Dec = 12,
}

local function ownerTitle()
    local me = mw.title.new('Me')
    if not me then return nil end
    local target = me.redirectTarget
    return target or me
end

local function ownerPageContent()
    local title = ownerTitle()
    if not title then return nil end
    return title:getContent()
end

local function extractBirthDate(content)
    if not content then return '' end

    local iso = content:match('|%s*birth%s*=%s*(%d%d%d%d%-%d%d%-%d%d)')
    if iso then return iso end

    local monthName, day, year = content:match(
        'born%s+(%a+)%s+(%d+),?%s+(%d%d%d%d)')
    if monthName then
        local m = MONTHS[monthName]
        if m then
            return string.format('%04d-%02d-%02d', year, m, day)
        end
    end

    local day2, monthName2, year2 = content:match(
        'born%s+(%d+)%s+(%a+)%s+(%d%d%d%d)')
    if monthName2 then
        local m = MONTHS[monthName2]
        if m then
            return string.format('%04d-%02d-%02d', year2, m, day2)
        end
    end

    return ''
end

function p.firstName(frame)
    -- Optional explicit override via Template:Name
    -- (lets the owner choose a nickname different from their page title).
    local nameTpl = mw.title.new('Template:Name')
    if nameTpl and nameTpl.exists then
        local tplContent = nameTpl:getContent() or ''
        local override = tplContent:match('<onlyinclude>(.-)</onlyinclude>')
        if override and override ~= '' then
            return mw.text.trim(override)
        end
    end

    -- Default: first whitespace-delimited token of the owner's page title.
    local title = ownerTitle()
    if not title then return '' end
    return title.text:match('^(%S+)') or title.text
end

function p.birthDate(frame)
    return extractBirthDate(ownerPageContent())
end

function p.daysLived(frame)
    local iso = extractBirthDate(ownerPageContent())
    if iso == '' then return '' end
    local y, m, d = iso:match('(%d%d%d%d)%-(%d%d)%-(%d%d)')
    local birth = os.time({ year = tonumber(y), month = tonumber(m), day = tonumber(d), hour = 12 })
    local now = os.time()
    return math.floor((now - birth) / 86400)
end

return p
