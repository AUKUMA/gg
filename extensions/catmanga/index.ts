import {
  GetSeriesFunc,
  GetChaptersFunc,
  GetPageRequesterDataFunc,
  GetPageUrlsFunc,
  GetSearchFunc,
  GetPageDataFunc,
  ExtensionMetadata,
  PageRequesterData,
  GetDirectoryFunc,
  GenreKey,
  ThemeKey,
  FormatKey,
  ContentWarningKey,
  DemographicKey,
  ExtensionClientAbstract,
  GetSettingsFunc,
  SetSettingsFunc,
  GetSettingTypesFunc,
} from "houdoku-extension-lib";
import {
  Chapter,
  LanguageKey,
  Series,
  SeriesSourceType,
  SeriesStatus,
} from "houdoku-extension-lib";
import { Response } from "node-fetch";
import metadata from "./metadata.json";
import { parseMetadata } from "../../util/configuring";

export const METADATA: ExtensionMetadata = parseMetadata(metadata);

const SERIES_STATUS_MAP: { [key: string]: SeriesStatus } = {
  ongoing: SeriesStatus.ONGOING,
  completed: SeriesStatus.COMPLETED,
};

const GENRE_MAP: { [key: string]: GenreKey } = {
  action: GenreKey.ACTION,
  adventure: GenreKey.ADVENTURE,
  comedy: GenreKey.COMEDY,
  crime: GenreKey.CRIME,
  drama: GenreKey.DRAMA,
  fantasy: GenreKey.FANTASY,
  historical: GenreKey.HISTORICAL,
  horror: GenreKey.HORROR,
  isekai: GenreKey.ISEKAI,
  mystery: GenreKey.MYSTERY,
  psychological: GenreKey.PSYCHOLOGICAL,
  romance: GenreKey.ROMANCE,
  scifi: GenreKey.SCI_FI,
  sliceoflife: GenreKey.SLICE_OF_LIFE,
  sports: GenreKey.SPORTS,
  thriller: GenreKey.THRILLER,
  tragedy: GenreKey.TRAGEDY,
  yaoi: GenreKey.YAOI,
  yuri: GenreKey.YURI,
};

const THEME_MAP: { [key: string]: ThemeKey } = {
  harem: ThemeKey.HAREM,
  incest: ThemeKey.INCEST,
  office: ThemeKey.OFFICE_WORKERS,
  schoollife: ThemeKey.SCHOOL_LIFE,
  supernatural: ThemeKey.SUPERNATURAL,
};

const FORMAT_MAP: { [key: string]: FormatKey } = {};

const CONTENT_WARNING_MAP: { [key: string]: ContentWarningKey } = {};

const DEMOGRAPHIC_MAP: { [key: string]: DemographicKey } = {
  shounen: DemographicKey.SHOUNEN,
  seinen: DemographicKey.SEINEN,
  shoujo: DemographicKey.SHOUJO,
  josei: DemographicKey.JOSEI,
};

type DirectoryEntry = {
  series_id: string;
  title: string;
  alt_titles: string[];
  description: string;
  authors: string[];
  genres: string[];
  status: string;
  chapters: {
    title: string;
    groups: string[];
    number: number;
    volume: number;
  }[];
  cover_art: {
    source: string;
    width: number;
    height: number;
  };
};

const _mapSeriesData = (directoryEntry: DirectoryEntry): Series => {
  const genres: GenreKey[] = [];
  const themes: ThemeKey[] = [];
  const formats: FormatKey[] = [];
  const contentWarnings: ContentWarningKey[] = [];
  const demographics: DemographicKey[] = [DemographicKey.UNCERTAIN];

  directoryEntry.genres.forEach((genre: string) => {
    const tagStr = genre.trim().replace(" ", "").replace("-", "").toLowerCase();
    if (tagStr !== undefined) {
      if (tagStr in GENRE_MAP) {
        genres.push(GENRE_MAP[tagStr]);
      }
      if (tagStr in THEME_MAP) {
        themes.push(THEME_MAP[tagStr]);
      }
      if (tagStr in FORMAT_MAP) {
        formats.push(FORMAT_MAP[tagStr]);
      }
      if (tagStr in CONTENT_WARNING_MAP) {
        contentWarnings.push(CONTENT_WARNING_MAP[tagStr]);
      }
      if (tagStr in DEMOGRAPHIC_MAP) {
        demographics.push(DEMOGRAPHIC_MAP[tagStr]);
      }
    }
  });

  const series: Series = {
    id: undefined,
    extensionId: METADATA.id,
    sourceId: directoryEntry.series_id,
    sourceType: SeriesSourceType.STANDARD,
    title: directoryEntry.title,
    altTitles: directoryEntry.alt_titles,
    description: directoryEntry.description,
    authors: directoryEntry.authors,
    artists: [],
    genres: genres,
    themes: themes,
    formats: formats,
    contentWarnings: contentWarnings,
    demographic: demographics.pop(),
    status: SERIES_STATUS_MAP[directoryEntry.status],
    originalLanguageKey: LanguageKey.JAPANESE,
    numberUnread: 0,
    remoteCoverUrl: directoryEntry.cover_art.source,
    userTags: [],
  };
  return series;
};

export class ExtensionClient extends ExtensionClientAbstract {
  fullDirectoryList: DirectoryEntry[] = [];

  _getDirectoryList = async () => {
    return this.fetchFn(`https://catmanga.org`)
      .then((response: Response) => response.text())
      .then((data: string) => {
        const doc = this.domParser.parseFromString(data);
        const nextDataText = doc.getElementById("__NEXT_DATA__").textContent;
        const nextData = JSON.parse(nextDataText);

        this.fullDirectoryList = nextData.props.pageProps
          .series as DirectoryEntry[];
      });
  };

  getMetadata: () => ExtensionMetadata = () => {
    return METADATA;
  };

  getSeries: GetSeriesFunc = async (
    sourceType: SeriesSourceType,
    id: string
  ) => {
    if (this.fullDirectoryList.length === 0) await this._getDirectoryList();

    const entry = this.fullDirectoryList.find(
      (_entry) => _entry.series_id === id
    );

    return entry === undefined ? undefined : _mapSeriesData(entry);
  };

  getChapters: GetChaptersFunc = async (
    sourceType: SeriesSourceType,
    id: string
  ) => {
    if (this.fullDirectoryList.length === 0) await this._getDirectoryList();

    const entry = this.fullDirectoryList.find(
      (_entry) => _entry.series_id === id
    );
    if (entry === undefined) return [];

    return entry.chapters.map((chapterData: any) => {
      const chapter: Chapter = {
        id: undefined,
        seriesId: undefined,
        sourceId: `${chapterData.number}`,
        title: chapterData.title ? chapterData.title : "",
        chapterNumber: `${chapterData.number}`,
        volumeNumber: "",
        languageKey: LanguageKey.ENGLISH,
        groupName: chapterData.groups.length > 0 ? chapterData.groups[0] : "",
        time: 0,
        read: false,
      };
      return chapter;
    });
  };

  getPageRequesterData: GetPageRequesterDataFunc = (
    sourceType: SeriesSourceType,
    seriesSourceId: string,
    chapterSourceId: string
  ) => {
    return this.fetchFn(
      `https://catmanga.org/series/${seriesSourceId}/${chapterSourceId}`
    )
      .then((response: Response) => response.text())
      .then((data: string) => {
        const doc = this.domParser.parseFromString(data);
        const nextDataText = doc.getElementById("__NEXT_DATA__").textContent;
        const nextData = JSON.parse(nextDataText);

        const pages = nextData.props.pageProps.pages;

        return {
          server: "",
          hash: "",
          numPages: pages.length,
          pageFilenames: pages,
        };
      });
  };

  getPageUrls: GetPageUrlsFunc = (pageRequesterData: PageRequesterData) => {
    return pageRequesterData.pageFilenames;
  };

  getPageData: GetPageDataFunc = (series: Series, url: string) => {
    return new Promise((resolve, reject) => {
      resolve(url);
    });
  };

  getDirectory: GetDirectoryFunc = async (page: number) => {
    if (this.fullDirectoryList.length === 0) await this._getDirectoryList();

    return {
      seriesList: this.fullDirectoryList.map((seriesData: any) => {
        return _mapSeriesData(seriesData);
      }),
      hasMore: false,
    };
  };

  getSearch: GetSearchFunc = async (
    text: string,
    params: { [key: string]: string },
    page: number
  ) => {
    if (this.fullDirectoryList.length === 0) await this._getDirectoryList();

    const seriesList: Series[] = this.fullDirectoryList.map(
      (seriesData: any) => {
        return _mapSeriesData(seriesData);
      }
    );

    return {
      seriesList: seriesList.filter((series: Series) => {
        return series.title.toLowerCase().includes(text.toLowerCase());
      }),
      hasMore: false,
    };
  };

  getSettingTypes: GetSettingTypesFunc = () => {
    return {};
  };

  getSettings: GetSettingsFunc = () => {
    return {};
  };

  setSettings: SetSettingsFunc = () => {};
}
