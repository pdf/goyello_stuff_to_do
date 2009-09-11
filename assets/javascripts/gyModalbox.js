
if(!window.gyModalbox)
{
  gyModalbox = new Object();
}

gyModalbox.createOverlay = function()
{
  this.overlay = $('gyOverlay');
  if(null == this.overlay)
  {
    this.overlay = $(document.createElement('div'));
    this.overlay.setAttribute('id', 'gyOverlay');

    this.overlay.update('');
    this.overlay.className = '';
    
    this.overlay.setStyle({
      position: 'absolute',
      left: '0',
      top: '0',
      width: $$('body')[0].getWidth() + 'px',
      height: $$('body')[0].getHeight() + 'px',
      zIndex: '9999',
      background: '#ddd',
      '-ms-filter': "progid:DXImageTransform.Microsoft.Alpha(Opacity=" + this.options.opacity + ")",
      filter: 'progid:DXImageTransform.Microsoft.Alpha(Opacity=' + this.options.opacity + ')',
      opacity: this.options.opacity
    })

    document.body.appendChild(this.overlay);
  }
}

gyModalbox.updateElementStyle = function()
{
  if(null != this.element)
  {
//    document.body.appendChild(this.element);
    var options = this.options;
    this.element.setStyle({
      position: 'absolute',
      zIndex: '10000',
      left: options.left + 'px',
      top: options.top + 'px',
      width: options.width + 'px',
      background: '#777',
      height: options.height == undefined ? 'auto' : options.height + 'px',
      border: 'none'//'1px solid black'
    })
  }
}

gyModalbox.defaultOptions = function()
{
  this.options = {
    opacity: 0.65,
    left: document.viewport.getScrollOffsets()['left'] + 
    document.viewport.getWidth() / 2 - this.element.getWidth() / 2,
    top: document.viewport.getScrollOffsets()['top'] +
    document.viewport.getHeight() / 2 - this.element.getHeight() / 2,
    width: 600
  }
}

gyModalbox.show = function(element, options)
{
  if(null == element)
  {
    throw new Error('\'element\' argument is null.');
  }

  this.element = $(element);
  if(null == this.element)
  {
    throw new Error('Element is null');
  }

  this.defaultOptions();
  Object.extend(this.options, options);

  this.createOverlay();
  this.updateElementStyle();

  this.overlay.show();
  this.element.show();

  this.updateHeight();
}

gyModalbox.updateHeight = function()
{
  var saveButton = $$('input[value="Save"]');

  if(saveButton.length == 1)
  {
    saveButton = saveButton[0];
    this.element.setStyle({
      height: (saveButton.cumulativeOffset()['top'] + saveButton.getHeight() -
        this.element.cumulativeOffset()['top'] + 12) + 'px'
    });
  }
}

gyModalbox.hide = function()
{
  if(null != this.overlay && null != this.element)
  {
    this.overlay.hide();
    this.element.hide();
  }
}