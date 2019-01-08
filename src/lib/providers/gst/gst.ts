import { Injectable } from '@angular/core';

import {Angulartics2, GoogleGlobalSiteTagSettings, UserTimings} from 'angulartics2';
import {UserTimingsGst} from './gst-interfaces';

declare var gtag: any;
declare var ga: any;

export class GoogleGlobalSiteTagDefaults implements GoogleGlobalSiteTagSettings {
  trackingIds = [];

  constructor() {
    if (typeof ga !== 'undefined' && ga) {
      // See: https://developers.google.com/analytics/devguides/collection/analyticsjs/ga-object-methods-reference
      ga(() => {
        ga.getAll().forEach((tracker) => {
          const id = tracker.get('trackingId');
          if (id !== undefined) {
            this.trackingIds.push(id);
          }
        });
      });
    }
  }
}

@Injectable({ providedIn: 'root' })
export class Angulartics2GoogleGlobalSiteTag {

  constructor(protected angulartics2: Angulartics2) {
    const defaults = new GoogleGlobalSiteTagDefaults;
    // Set the default settings for this module
    this.angulartics2.settings.gst = { ...defaults, ...this.angulartics2.settings.gst };
  }

  startTracking(): void {
    this.angulartics2.pageTrack
      .pipe(this.angulartics2.filterDeveloperMode())
      .subscribe((x) => this.pageTrack(x.path));
    this.angulartics2.eventTrack
      .pipe(this.angulartics2.filterDeveloperMode())
      .subscribe((x) => this.eventTrack(x.action, x.properties));
    this.angulartics2.exceptionTrack
      .pipe(this.angulartics2.filterDeveloperMode())
      .subscribe((x: any) => this.exceptionTrack(x));
    this.angulartics2.userTimings
      .pipe(this.angulartics2.filterDeveloperMode())
      .subscribe(x => this.userTimings(this.convertTimings(x)));
  }

  /**
   * Manually track page view, see:
   *
   * https://developers.google.com/analytics/devguides/collection/gtagjs/single-page-applications#tracking_virtual_pageviews
   *
   * @param path relative url
   */
  pageTrack(path: string) {
    if (typeof gtag !== 'undefined' && gtag) {
      for (const id of this.angulartics2.settings.gst.trackingIds) {
        gtag('config', id, {'page_path': path});
      }
    }
  }

  /**
   * Send interactions to gtag, i.e. for event tracking in Google Analytics. See:
   *
   * https://developers.google.com/analytics/devguides/collection/gtagjs/events
   *
   * @param action associated with the event
   */
  eventTrack(action: string, properties: any) {
    // TODO: make interface
    //  @param {string} properties.category
    //  @param {string} [properties.label]
    //  @param {number} [properties.value]
    //  @param {boolean} [properties.noninteraction]
    // Set a default GST category
    properties = properties || {};

    this.eventTrackInternal(action, {
      event_category: properties.category || 'interaction',
      event_label: properties.label,
      value: properties.value,
      non_interaction: properties.noninteraction,
      ...properties.gstCustom
    });
  }

  /**
   * Exception Track Event in GST. See:
   *
   * https://developers.google.com/analytics/devguides/collection/gtagjs/exceptions
   *
   */
  exceptionTrack(properties: any) {
    // TODO: make interface
    //  @param {Object} properties
    //  @param {string} [properties.description]
    //  @param {boolean} [properties.fatal]
    if (properties.fatal === undefined) {
      console.log('No "fatal" provided, sending with fatal=true');
      properties.fatal = true;
    }

    properties.exDescription = properties.event ? properties.event.stack : properties.description;

    this.eventTrack('exception', {
      gstCustom: {
        'description': properties.exDescription,
        'fatal': properties.fatal,
        ...properties.gstCustom
      }
    });
  }

  /**
   * User Timings Event in GST.
   * @name userTimings
   *
   * @param properties Comprised of the mandatory fields:
   *  - name (string)
   *  - value (number - integer)
   * Properties can also have the optional fields:
   *  - category (string)
   *  - label (string)
   *
   * @link https://developers.google.com/analytics/devguides/collection/gtagjs/user-timings
   */
  userTimings(properties: UserTimingsGst) {
    if (!properties) {
      console.error('User timings - "properties" parameter is required to be set.');
      return;
    }

    this.eventTrackInternal('timing_complete', {
      name: properties.name,
      value: properties.value,
      event_category: properties.category,
      event_label: properties.label
    });
  }

  private convertTimings(properties: UserTimings): UserTimingsGst {
    return {
      name: properties.timingVar,
      value: properties.timingValue,
      category: properties.timingCategory,
      label: properties.timingLabel
    };
  }

  private eventTrackInternal(action: string, properties: any) {
    if (typeof gtag === 'undefined' || !gtag) {
      return;
    }

    properties = properties || {};
    gtag('event', action, properties);
  }
}
