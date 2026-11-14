/* Pic4Review MissionReviewGallery3Component, adapted for Fotoshi only.
 * Original copyright Adrien Pavie / Pic4Review contributors. AGPL-3.0-or-later. */
import React, { Component } from "react";
import ImageGallery from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";
export default class Gallery extends Component {
  render() {
    const photos = this.props.pictures || [];
    if (!photos.length)
      return <div className="empty">No photographs for this place.</div>;
    return (
      <ImageGallery
        items={photos.map((picture, index) => ({
          original: picture.pictureUrl,
          thumbnail: picture.thumbUrl,
          id: index,
          picture,
        }))}
        startIndex={this.props.currentPictureId || 0}
        ref={this.props.galleryRef}
        infinite
        lazyLoad
        showPlayButton={false}
        showFullscreenButton
        showThumbnails={photos.length > 1}
        thumbnailPosition="bottom"
        showIndex={photos.length > 1}
        slideDuration={180}
        onSlide={(id) => this.props.onCenterPicChanged(id)}
        renderItem={(item) => (
          <div className="evidence-image">
            <img
              src={item.original}
              alt="Photographic evidence for the selected place"
              onError={(e) => {
                if (!e.target.dataset.fallback) {
                  e.target.dataset.fallback = "1";
                  e.target.src = item.thumbnail;
                }
              }}
            />
            <a
              className="photo-credit"
              href={item.picture.detailsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {[
                item.picture.author,
                item.picture.date?.slice(0, 10),
                item.picture.license,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              ↗
            </a>
          </div>
        )}
      />
    );
  }
}
