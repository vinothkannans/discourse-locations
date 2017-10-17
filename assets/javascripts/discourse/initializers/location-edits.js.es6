import Composer from 'discourse/models/composer';
import ComposerBody from 'discourse/components/composer-body';
import Topic from 'discourse/models/topic';
import TopicController from 'discourse/controllers/topic';
import NavItem from 'discourse/models/nav-item';
import EditCategorySettings from 'discourse/components/edit-category-settings';
import { default as computed, observes } from 'ember-addons/ember-computed-decorators';

export default {
  name: 'location-edits',
  initialize(container) {
    Composer.reopen({
      @computed('subtype', 'categoryId', 'topicFirstPost')
      showLocationControls(subtype, categoryId, topicFirstPost) {
        if (!topicFirstPost) return false;

        const topicTypes = Discourse.SiteSettings.composer_topic_types;
        if (topicTypes && topicTypes.split('|').indexOf(subtype) > -1 && subtype === 'event') {
          return true;
        };

        if (categoryId) {
          const category = this.site.categories.findBy('id', categoryId);
          return category.location_enabled;
        }
      },

      clearState() {
        this._super(...arguments);
        this.set('location', null);
      }
    });

    Composer.serializeOnCreate('location');
    Composer.serializeToTopic('location', 'topic.location');

    ComposerBody.reopen({
      @observes('composer.location')
      resizeWhenLocationAdded: function() {
        this.resize();
      },

      @observes('composer.showLocationControls')
      applyLocationInlineClass() {
        Ember.run.scheduleOnce('afterRender', this, () => {
          $('.composer-controls-location').toggleClass('show-control', Boolean(this.get('composer.showLocationControls')));
          this.resize();
        });
      }
    });

    const subtypeShowLocation = ['event', 'question', 'general'];
    Topic.reopen({
      @computed('subtype', 'category.location_enabled')
      showLocationControls(subtype, categoryEnabled) {
        return subtypeShowLocation.indexOf(subtype) > -1 || categoryEnabled;
      }
    });

    // necessary because topic-title plugin outlet only recieves model
    TopicController.reopen({
      @observes('editingTopic')
      setEditingTopicOnModel() {
        this.set('model.editingTopic', this.get('editingTopic'));
      }
    });

    NavItem.reopenClass({
      buildList(category, args) {
        let items = this._super(category, args);

        if (category && category.location_enabled && Discourse.SiteSettings.location_category_map_filter) {
          items.push(Discourse.NavItem.fromText('map', args));
        }

        return items;
      }
    });

    EditCategorySettings.reopen({
      @computed('category')
      availableViews(category) {
        let views = this._super(...arguments);

        if (category.get('location_enabled') && Discourse.SiteSettings.location_category_map_filter) {
          views.push(
            {name: I18n.t('filters.map.title'), value: 'map'}
          );
        }

        return views;
      },
    });

    const mapRoutes = [
      `MapCategory`,
      `MapParentCategory`,
      `MapCategoryNone`
    ];

    mapRoutes.forEach(function(route){
      var route = container.lookup(`route:discovery.${route}`);
      route.reopen({
        afterModel(model) {
          if (!Discourse.SiteSettings.location_category_map_filter) {
            this.replaceWith(`/c/${Discourse.Category.slugFor(model.category)}`);
          }
          return this._super(...arguments);
        },

        renderTemplate() {
          this.render('navigation/category', { outlet: 'navigation-bar' });
          this.render("discovery/map", { outlet: "list-container", controller: 'discovery/topics' });
        }
      });
    });

    const categoryRoutes = [
      'category',
      'parentCategory',
      'categoryNone'
    ];

    categoryRoutes.forEach(function(route){
      var route = container.lookup(`route:discovery.${route}`);
      route.reopen({
        afterModel(model) {
          if (this.filter(model.category) === 'map' && Discourse.SiteSettings.location_category_map_filter) {
            return this.replaceWith(`/c/${Discourse.Category.slugFor(model.category)}/l/${this.filter(model.category)}`);
          } else {
            return this._super(...arguments);
          }
        }
      });
    });
  }
};
