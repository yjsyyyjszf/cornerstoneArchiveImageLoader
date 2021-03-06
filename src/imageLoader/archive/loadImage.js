import $ from 'jquery';
import * as cornerstone from 'cornerstone-core';
import createImage from '../createImage.js';
import parseImageId from './parseImageId.js';
import dataSetCacheManager from './dataSetCacheManager.js';
import getEncapsulatedImageFrame from './getEncapsulatedImageFrame.js';
import getUncompressedImageFrame from './getUncompressedImageFrame.js';
import unzipFileRequest from './unzipFileRequest.js';

// add a decache callback function to clear out our dataSetCacheManager
function addDecache (image) {
  image.decache = function () {
    const parsedImageId = parseImageId(image.imageId);

    dataSetCacheManager.unload(parsedImageId.url);
  };
}

function getPixelData (dataSet, frameIndex) {
  const pixelDataElement = dataSet.elements.x7fe00010;

  if (pixelDataElement.encapsulatedPixelData) {
    return getEncapsulatedImageFrame(dataSet, frameIndex);
  }

  return getUncompressedImageFrame(dataSet, frameIndex);

}

function loadImageFromPromise (dataSetPromise, imageId, frame, sharedCacheKey, options) {
  const start = new Date().getTime();

  frame = frame || 0;
  const deferred = $.Deferred();

  dataSetPromise.then(function (dataSet/* , xhr*/) {
    const pixelData = getPixelData(dataSet, frame);
    const transferSyntax = dataSet.string('x00020010');
    const loadEnd = new Date().getTime();
    const imagePromise = createImage(imageId, pixelData, transferSyntax, options);

    imagePromise.then(function (image) {
      image.data = dataSet;
      const end = new Date().getTime();

      image.loadTimeInMS = loadEnd - start;
      image.totalTimeInMS = end - start;
      addDecache(image);
      deferred.resolve(image);
    });
  }, function (error) {
    deferred.reject(error);
  });

  return deferred;
}

function getLoaderForScheme (scheme) {
  if (scheme === 'ziparchive') {
    return unzipFileRequest;
  }  // end if
}  // end function getLoaderForScheme

function loadImage (imageId, options) {
  const parsedImageId = parseImageId(imageId);
  const loader = getLoaderForScheme(parsedImageId.scheme);

  // if the dataset for this url is already loaded, use it
  if (dataSetCacheManager.isLoaded(parsedImageId.url)) {

    return loadImageFromPromise(dataSetCacheManager.load(parsedImageId.url, loader, imageId), imageId, parsedImageId.frame, parsedImageId.url, options);
  }

  // load the dataSet via the dataSetCacheManager

  return loadImageFromPromise(dataSetCacheManager.load(parsedImageId.url, loader, imageId), imageId, parsedImageId.frame, parsedImageId.url, options);
}

// register ziparchive image loader prefix
cornerstone.registerImageLoader('ziparchive', loadImage);

export default loadImage;
