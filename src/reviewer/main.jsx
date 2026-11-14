/* Fotoshi2OSM, a focused Pic4Review derivative. AGPL-3.0-or-later. */
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import Question from "./Question";
import Gallery from "./Gallery";
import ReviewMap from "./ReviewMap";
import { areas, missions, loadQueue, loadDetails } from "./data";
import { loadElement, diffTags, saveEdit } from "./osm";
import { login, logout, getUser, getToken } from "./auth";
import "./reviewer.css";
const initial = new URLSearchParams(location.search);
const common = ["name", "opening_hours", "wheelchair", "website", "phone"];
const titleKey = (k) =>
  ({
    name: "Name",
    opening_hours: "Opening hours",
    wheelchair: "Wheelchair access",
    website: "Website",
    phone: "Phone",
  })[k] || k;
function App() {
  const [area, setArea] = useState(
    areas[initial.get("area")] ? initial.get("area") : "goldau",
  );
  const [mission, setMission] = useState(
    missions[initial.get("mission")] ? initial.get("mission") : "linked",
  );
  const [queue, setQueue] = useState([]),
    [index, setIndex] = useState(0),
    [photo, setPhoto] = useState(0),
    [loading, setLoading] = useState(true);
  const [base, setBase] = useState(null),
    [edits, setEdits] = useState({}),
    [sources, setSources] = useState({}),
    [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(""),
    [osmError, setOsmError] = useState(""),
    [user, setUser] = useState(null),
    [authBusy, setAuthBusy] = useState(false);
  const [preview, setPreview] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [saving, setSaving] = useState(false),
    [success, setSuccess] = useState(null);
  const [comment, setComment] = useState(
    "Review place details using Fotoshi photographs",
  );
  const [newKey, setNewKey] = useState(""),
    [newValue, setNewValue] = useState("");
  const [reload, setReload] = useState(0);
  const gallery = useRef(),
    detailCache = useRef(new Map()),
    initialPlace = useRef(initial.get("fid"));
  const place = queue[index] || null;
  const diff = base ? diffTags(base.tags, edits) : [];
  const dirty = useRef(false);
  dirty.current = diff.length > 0;
  useEffect(() => {
    getUser()
      .then(setUser)
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement,
      dialog = document.querySelector('[role="dialog"]');
    dialog?.querySelector("button")?.focus();
    const keys = (e) => {
      if (e.key === "Escape" && !saving) {
        setPreview(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = [
        ...dialog.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),textarea,a[href]",
        ),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [preview, saving]);
  useEffect(() => {
    const leave = (e) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setMessage("");
    setQueue([]);
    setIndex(0);
    (async () => {
      let rows = await loadQueue(area, mission, abort.signal);
      if (initialPlace.current) {
        const fid = initialPlace.current;
        const p = await loadDetails(fid, abort.signal);
        if (p) {
          rows = [p, ...rows.filter((x) => x.fid !== p.fid)];
          detailCache.current.set(p.fid, p);
        }
        initialPlace.current = null;
      }
      if (!abort.signal.aborted) {
        setQueue(rows);
        setLoading(false);
        if (!rows.length)
          setMessage(
            "No photographed places in this queue. Try another area or mission.",
          );
      }
    })().catch((e) => {
      if (e.name !== "AbortError") {
        setMessage(e.message);
        setLoading(false);
      }
    });
    return () => abort.abort();
  }, [area, mission]);
  useEffect(() => {
    setBase(null);
    setEdits({});
    setSources({});
    setEditing(false);
    setPreview(false);
    setConfirmed(false);
    setSuccess(null);
    setOsmError("");
    setPhoto(0);
    if (!place) return;
    const abort = new AbortController();
    if (place.ref)
      loadElement(place.ref, abort.signal)
        .then(setBase)
        .catch((e) => {
          if (e.name !== "AbortError") setOsmError(e.message);
        });
    if (!detailCache.current.has(place.fid))
      loadDetails(place.fid, abort.signal)
        .then((detail) => {
          if (!detail || abort.signal.aborted) return;
          detailCache.current.set(place.fid, detail);
          setQueue((rows) =>
            rows.map((p) =>
              p.fid === detail.fid ? { ...p, ...detail, origin: p.origin } : p,
            ),
          );
        })
        .catch((e) => {
          if (e.name !== "AbortError")
            setMessage(
              "Full photo details unavailable. Showing available photos.",
            );
        });
    return () => abort.abort();
  }, [place?.fid, place?.ref, reload]);
  useEffect(() => {
    if (!place) return;
    const q = new URLSearchParams({ area, mission, fid: place.fid });
    if (place.photos[photo]) q.set("photo", place.photos[photo].id);
    history.replaceState(null, "", location.pathname + "?" + q);
  }, [place?.fid, place?.photos[photo]?.id, photo, area, mission]);
  useEffect(() => {
    if (!place || initial.get("photo") === null) return;
    const n = place.photos.findIndex((p) => p.id === initial.get("photo"));
    if (n >= 0) {
      setPhoto(n);
      gallery.current?.slideToIndex(n);
      initial.delete("photo");
    }
  }, [place?.photos]);
  function safeLeave() {
    return !diff.length || window.confirm("Discard these unsaved tag changes?");
  }
  function move(step) {
    if (!saving && safeLeave()) {
      setIndex((n) => Math.max(0, Math.min(queue.length - 1, n + step)));
      setMessage("");
    }
  }
  function edit(key, value, source = "photo") {
    setEdits((e) => ({ ...e, [key]: value }));
    setSources((s) => ({ ...s, [key]: source }));
    setSuccess(null);
  }
  async function signin() {
    setAuthBusy(true);
    setMessage("");
    try {
      setUser(await login());
    } catch (e) {
      setMessage(e.message);
    } finally {
      setAuthBusy(false);
    }
  }
  async function submit() {
    if (!confirmed || !diff.length || !user || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await saveEdit({
        base,
        edits,
        comment,
        token: getToken(),
        overture: diff.some((d) => sources[d.key] === "overture"),
      });
      setSuccess(result);
      setEdits({});
      setSources({});
      setPreview(false);
      setEditing(false);
      setConfirmed(false);
      try {
        setBase(await loadElement(place.ref));
      } catch {
        setBase(null);
        setOsmError("Saved. Reload OSM tags before making another edit.");
      }
    } catch (e) {
      if (e.status === 401) {
        logout();
        setUser(null);
      }
      setMessage(e.message);
      if (e.changeset) setSuccess({ id: e.changeset, error: true });
    } finally {
      setSaving(false);
    }
  }
  const fields = base ? [...new Set([...common, ...Object.keys(edits)])] : [];
  const idLink = place
    ? `https://osm.fotoshi.com/#map=19/${place.loc[1]}/${place.loc[0]}&photo=fotoshi/${place.photos[photo]?.id || ""}${place.ref ? "&id=" + { node: "n", way: "w", relation: "r" }[place.ref.split("/")[0]] + place.ref.split("/")[1] : ""}`
    : "";
  return (
    <div className="reviewer">
      <header className="app-header">
        <a className="brand" href="./" aria-label="Fotoshi2OSM">
          <img src="./images/logo.svg" alt="" />
          <img
            className="wordmark"
            src="./images/wordmark.svg"
            alt="fotoshi2OSM"
          />
        </a>
        <div className="mission-controls">
          <select
            aria-label="Mission"
            disabled={saving}
            value={mission}
            onChange={(e) => {
              if (safeLeave()) setMission(e.target.value);
            }}
          >
            {Object.entries(missions).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Area"
            disabled={saving}
            value={area}
            onChange={(e) => {
              if (safeLeave()) setArea(e.target.value);
            }}
          >
            {Object.entries(areas).map(([key, a]) => (
              <option key={key} value={key}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {user ? (
          <button
            className="account"
            disabled={saving}
            onClick={() => {
              logout();
              setUser(null);
            }}
            title="Sign out of Fotoshi2OSM"
          >
            {user.display_name} · Sign out
          </button>
        ) : (
          <button className="signin" disabled={authBusy} onClick={signin}>
            {authBusy ? "Signing in…" : "Sign in with OSM"}
          </button>
        )}
      </header>
      {message && (
        <div className="message" role="alert">
          {message}
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      <main className="workspace">
        <section className="left-pane" aria-label="Place review">
          <div className="review-panel">
            {loading ? (
              <div className="empty">Finding photographed places…</div>
            ) : !place ? (
              <div className="empty">
                {message || "No places to review."}
                <button onClick={() => setMission("all")}>
                  Show all places
                </button>
              </div>
            ) : (
              <>
                <div className="place-heading">
                  <div>
                    <h1>{place.name}</h1>
                    <p>{place.category}</p>
                  </div>
                  <span className="position">
                    {index + 1} / {queue.length}
                  </span>
                </div>
                <div className="object-line">
                  {place.ref ? (
                    <a
                      href={"https://www.openstreetmap.org/" + place.ref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Already in OSM · {place.ref} ↗
                    </a>
                  ) : (
                    <span>No linked OSM object</span>
                  )}
                  <details className="identity">
                    <summary>Details</summary>
                    <div>Fotoshi: {place.fid}</div>
                    <div>Origin: {place.origin}</div>
                    {place.gers && <div>GERS: {place.gers}</div>}
                  </details>
                </div>
                {success && (
                  <div
                    className={
                      success.error ? "save-result error" : "save-result"
                    }
                    role="status"
                  >
                    {success.error
                      ? "Check upload outcome"
                      : success.warning || "Saved to OpenStreetMap."}{" "}
                    <a
                      href={
                        "https://www.openstreetmap.org/changeset/" + success.id
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Changeset #{success.id} ↗
                    </a>
                  </div>
                )}
                {osmError && (
                  <div className="error" role="alert">
                    {osmError}{" "}
                    <button onClick={() => setReload((x) => x + 1)}>
                      Reload OSM tags
                    </button>
                  </div>
                )}
                {!place.ref ? (
                  <div className="unlinked">
                    <h2>Check the map before adding</h2>
                    <p>
                      No linked ID doesn’t mean this place is missing. Use iD to
                      check for duplicates and add or link it.
                    </p>
                    <a
                      className="button primary"
                      href={idLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in iD ↗
                    </a>
                  </div>
                ) : !base && !osmError ? (
                  <p className="muted">Loading current OSM tags…</p>
                ) : base && !editing ? (
                  <Question
                    key={place.fid + ":" + reload}
                    data={{
                      question: "What can you verify in these photos?",
                      answers: [
                        { label: "Review name and details", value: "edit" },
                        { label: "Not enough evidence", value: "skip" },
                      ],
                    }}
                    onAnswerChange={(a) => {
                      if (a.value === "edit") setEditing(true);
                      else move(1);
                    }}
                  />
                ) : (
                  base && (
                    <>
                      <p className="hint">
                        Change only what the photos support.
                      </p>
                      <div className="tag-fields">
                        {fields.map((key) => (
                          <label key={key}>
                            {titleKey(key)}
                            <input
                              aria-label={titleKey(key)}
                              value={
                                Object.hasOwn(edits, key)
                                  ? edits[key] || ""
                                  : base.tags[key] || ""
                              }
                              placeholder="Not tagged"
                              maxLength={255}
                              onChange={(e) => edit(key, e.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                      <details className="more-tags">
                        <summary>
                          All current OSM tags ({Object.keys(base.tags).length})
                        </summary>
                        <dl>
                          {Object.entries(base.tags).map(([k, v]) => (
                            <div key={k}>
                              <dt>{k}</dt>
                              <dd>
                                {v}
                                <button
                                  type="button"
                                  onClick={() =>
                                    edit(
                                      k,
                                      Object.hasOwn(edits, k) ? edits[k] : v,
                                    )
                                  }
                                >
                                  Edit
                                </button>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                      <form
                        className="add-tag"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (newKey.trim()) {
                            edit(newKey.trim(), newValue);
                            setNewKey("");
                            setNewValue("");
                          }
                        }}
                      >
                        <input
                          aria-label="New tag key"
                          placeholder="Tag key"
                          value={newKey}
                          maxLength={255}
                          onChange={(e) => setNewKey(e.target.value)}
                        />
                        <input
                          aria-label="New tag value"
                          placeholder="Value"
                          value={newValue}
                          maxLength={255}
                          onChange={(e) => setNewValue(e.target.value)}
                        />
                        <button title="Add tag" aria-label="Add tag">
                          +
                        </button>
                      </form>
                      {place.overture?.tags && (
                        <details className="overture">
                          <summary>Overture tags</summary>
                          <p className="hint">
                            Use when photo evidence supports them.
                          </p>
                          {Object.entries(place.overture.tags)
                            .filter(
                              ([k, v]) =>
                                typeof v === "string" &&
                                v &&
                                base.tags[k] !== v,
                            )
                            .map(([k, v]) => (
                              <div key={k}>
                                <span>
                                  <b>{titleKey(k)}</b>
                                  <br />
                                  {v}
                                </span>
                                <button
                                  aria-label={"Use Overture " + k}
                                  onClick={() => edit(k, v, "overture")}
                                >
                                  +
                                </button>
                              </div>
                            ))}
                        </details>
                      )}
                      <div className="review-actions">
                        <button
                          className="primary"
                          disabled={!diff.length}
                          onClick={() => {
                            setConfirmed(false);
                            setPreview(true);
                          }}
                        >
                          Review {diff.length || ""} change
                          {diff.length === 1 ? "" : "s"}
                        </button>
                        <button
                          disabled={!diff.length}
                          onClick={() => {
                            setEdits({});
                            setSources({});
                          }}
                        >
                          Undo changes
                        </button>
                      </div>
                    </>
                  )
                )}
                <div className="queue-nav">
                  <button
                    disabled={index === 0 || saving}
                    onClick={() => move(-1)}
                  >
                    ← Previous
                  </button>
                  <a href={idLink} target="_blank" rel="noopener noreferrer">
                    Edit in iD ↗
                  </a>
                  <button
                    disabled={index === queue.length - 1 || saving}
                    onClick={() => move(1)}
                  >
                    Skip →
                  </button>
                </div>
              </>
            )}
          </div>
          {place && (
            <ReviewMap
              place={place}
              photoIndex={photo}
              onPhoto={(n) => {
                setPhoto(n);
                gallery.current?.slideToIndex(n);
              }}
            />
          )}
        </section>
        <section className="photo-pane" aria-label="Photo evidence">
          {place ? (
            <Gallery
              key={place.fid}
              pictures={place.photos}
              currentPictureId={photo}
              galleryRef={gallery}
              onCenterPicChanged={setPhoto}
            />
          ) : (
            <div className="empty">
              {loading
                ? "Loading photo evidence…"
                : "Choose another area or mission."}
            </div>
          )}
        </section>
      </main>
      <footer>
        Photos retain contributor licences ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OSM © contributors
        </a>{" "}
        · With thanks to{" "}
        <a
          href="https://framagit.org/Pic4Carto/Pic4Review"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pic4Review / Adrien Pavie
        </a>{" "}
        ·{" "}
        <a
          href="https://github.com/atlascove/fotoshi2osm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source · AGPL-3.0
        </a>
        {place && (
          <>
            {" "}
            ·{" "}
            <a
              href={`https://fotoshi.com/photo/${place.photos[photo]?.id}?report=photo`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Report photo
            </a>
          </>
        )}
      </footer>
      {preview && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            className="preview"
          >
            <button
              className="dismiss"
              aria-label="Close review"
              disabled={saving}
              onClick={() => setPreview(false)}
            >
              ×
            </button>
            <h2 id="preview-title">Review your changes</h2>
            <p>
              {place.name} · {place.ref}
            </p>
            <div className="diff-list">
              {diff.map((d) => (
                <div key={d.key}>
                  <code>{d.key}</code>
                  <del>{d.before || "Not tagged"}</del>
                  <ins>{d.after || "Remove tag"}</ins>
                </div>
              ))}
            </div>
            <label className="comment">
              Changeset comment
              <textarea
                aria-label="Changeset comment"
                maxLength={255}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <p className="hint">
              Source: Fotoshi
              {diff.some((d) => sources[d.key] === "overture")
                ? " + Overture Maps"
                : ""}
              . Saved under your OSM account.
            </p>
            <label className="confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={saving}
              />
              I checked the photos and these changes are supported.
            </label>
            {message && (
              <p className="error" role="alert">
                {message}{" "}
                <button
                  disabled={saving}
                  onClick={() => {
                    if (safeLeave()) setReload((n) => n + 1);
                  }}
                >
                  Reload OSM tags
                </button>
              </p>
            )}
            {success?.error && (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={"https://www.openstreetmap.org/changeset/" + success.id}
              >
                Check changeset #{success.id} before retrying ↗
              </a>
            )}
            {user ? (
              <button
                className="primary save"
                disabled={
                  !confirmed ||
                  !diff.length ||
                  saving ||
                  comment.trim().length < 3
                }
                onClick={submit}
              >
                {saving ? "Saving…" : "Save to OpenStreetMap"}
              </button>
            ) : (
              <button
                className="primary save"
                disabled={authBusy}
                onClick={signin}
              >
                Sign in with OSM to save
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("app")).render(<App />);
